package stores

import (
	"bytes"
	"context"
	"io"
	"net/http"
	"os"
	"strconv"
	"strings"
	"time"

	"github.com/code-100-precent/LingEcho/pkg/utils"
	"github.com/qiniu/go-sdk/v7/auth/qbox"
	"github.com/qiniu/go-sdk/v7/storage"
	"github.com/sirupsen/logrus"
)

// ----------------------------------------------------------------------
// QiNiu Store
// ----------------------------------------------------------------------

type QiNiuStore struct {
	AccessKey  string `env:"QINIU_ACCESS_KEY"`
	SecretKey  string `env:"QINIU_SECRET_KEY"`
	BucketName string `env:"QINIU_BUCKET"`
	// 绑定的访问域名，如：https://static.example.com 或 http://xxx.bkt.clouddn.com
	Domain string `env:"QINIU_DOMAIN"`
	// 是否为私有空间：私有空间的下载需要签名 URL
	Private bool `env:"QINIU_PRIVATE"`
	// 可选：手动指定区域标识（留空则自动发现）
	Region string `env:"QINIU_REGION"`
}

func NewQiNiuStore() Store {
	private := strings.EqualFold(utils.GetEnv("QINIU_PRIVATE"), "true")
	return &QiNiuStore{
		AccessKey:  utils.GetEnv("QINIU_ACCESS_KEY"),
		SecretKey:  utils.GetEnv("QINIU_SECRET_KEY"),
		BucketName: utils.GetEnv("QINIU_BUCKET"),
		Domain:     utils.GetEnv("QINIU_DOMAIN"),
		Private:    private,
		Region:     utils.GetEnv("QINIU_REGION"),
	}
}

func (q *QiNiuStore) getMac() *qbox.Mac {
	return qbox.NewMac(q.AccessKey, q.SecretKey)
}

// 生成 storage.Config，自动探测区域；若探测失败仍可正常使用（SDK 会在首次请求时向 UC 自动发现）
func (q *QiNiuStore) makeConfig() storage.Config {
	useHTTPS := strings.HasPrefix(strings.ToLower(q.Domain), "https://")
	cfg := storage.Config{
		UseHTTPS: useHTTPS,
	}
	// 自动探测区域（老版本 SDK 签名为 GetRegion(ak, bucket)）
	if zone, err := storage.GetRegion(q.AccessKey, q.BucketName); err == nil && zone != nil {
		cfg.Region = zone
	}
	// 如需强制区域，可在此依据 q.Region 设置 cfg.Region = &storage.RegionHuadong 等
	return cfg
}

func (q *QiNiuStore) uploadToken() string {
	p := storage.PutPolicy{
		Scope:   q.BucketName,
		Expires: 3600, // 1小时
	}
	return p.UploadToken(q.getMac())
}

// Write: 使用表单上传（将 r 读入内存以得到内容长度，适合中小文件；大文件建议换分片上传）
func (q *QiNiuStore) Write(key string, r io.Reader) error {
	data, err := io.ReadAll(r)
	if err != nil {
		return err
	}
	cfg := q.makeConfig()
	uploader := storage.NewFormUploader(&cfg)
	ret := storage.PutRet{}
	extra := storage.PutExtra{}
	token := q.uploadToken()

	// 使用 context.Background() 作为 context
	ctx := context.Background()
	return uploader.Put(ctx, &ret, token, key, bytes.NewReader(data), int64(len(data)), &extra)
}

// Exists: 通过 Stat 判断（612 表示不存在）
func (q *QiNiuStore) Exists(key string) (bool, error) {
	cfg := q.makeConfig()
	bm := storage.NewBucketManager(q.getMac(), &cfg)
	_, err := bm.Stat(q.BucketName, key)
	if err == nil {
		return true, nil
	}
	if e, ok := err.(*storage.ErrorInfo); ok && e.Code == 612 {
		return false, nil
	}
	return false, err
}

// Delete: 直接删除
func (q *QiNiuStore) Delete(key string) error {
	cfg := q.makeConfig()
	bm := storage.NewBucketManager(q.getMac(), &cfg)
	return bm.Delete(q.BucketName, key)
}

// Read: 通过 PublicURL（公有或带签名的私有）发起 HTTP GET
func (q *QiNiuStore) Read(key string) (io.ReadCloser, int64, error) {
	u := q.PublicURL(key)
	if u == "" {
		return nil, 0, ErrInvalidPath
	}
	resp, err := http.Get(u)
	if err != nil {
		return nil, 0, err
	}
	if resp.StatusCode != http.StatusOK {
		defer resp.Body.Close()
		return nil, 0, &utils.Error{Code: resp.StatusCode, Message: "qiniu read failed"}
	}
	var n int64 = -1
	if cl := resp.Header.Get("Content-Length"); cl != "" {
		if v, err := strconv.ParseInt(cl, 10, 64); err == nil {
			n = v
		}
	}
	return resp.Body, n, nil
}

// PublicURL: 公有空间返回公开 URL；私有空间返回带有效期签名的 URL（默认 1 小时）
func (q *QiNiuStore) PublicURL(key string) string {
	if q.Domain == "" {
		return ""
	}
	d := q.Domain
	if !strings.HasPrefix(d, "http://") && !strings.HasPrefix(d, "https://") {
		d = "http://" + d
	}
	// 公有 URL
	pub := storage.MakePublicURLv2(d, key)

	if !q.Private {
		return pub
	}
	// 私有下载 URL（签名，有效期 1 小时）
	deadline := time.Now().Add(1 * time.Hour).Unix()
	return storage.MakePrivateURL(q.getMac(), d, key, deadline)
}

// UpdateCallLogDetails 更新通话日志详情（使用统一存储）
func UpdateCallLogDetails() {
	logrus.WithFields(logrus.Fields{
		"storage": DefaultStoreKind,
	}).Info("call log details updated")
}

// UploadAudio 上传音频文件（使用统一存储）
func UploadAudio(filePath, key string) error {
	store := Default()

	// 读取本地文件
	file, err := os.Open(filePath)
	if err != nil {
		logrus.WithError(err).Error("failed to open audio file")
		return err
	}
	defer file.Close()

	// 上传到统一存储
	err = store.Write(key, file)
	if err != nil {
		logrus.WithError(err).Error("failed to upload audio")
		return err
	}

	logrus.WithFields(logrus.Fields{
		"filePath": filePath,
		"key":      key,
		"storage":  DefaultStoreKind,
	}).Info("audio uploaded successfully")

	return nil
}

// UploadTrace 上传追踪文件（使用统一存储）
func UploadTrace(filePath, key string) error {
	store := Default()

	// 读取本地文件
	file, err := os.Open(filePath)
	if err != nil {
		logrus.WithError(err).Error("failed to open trace file")
		return err
	}
	defer file.Close()

	// 上传到统一存储
	err = store.Write(key, file)
	if err != nil {
		logrus.WithError(err).Error("failed to upload trace")
		return err
	}

	logrus.WithFields(logrus.Fields{
		"filePath": filePath,
		"key":      key,
		"storage":  DefaultStoreKind,
	}).Info("trace uploaded successfully")

	return nil
}

// 以下函数保留以保持向后兼容，但已废弃，请使用上面的统一函数
// Deprecated: 使用 UploadAudio 代替
func UploadAudioToQiniu(filePath, key string) error {
	return UploadAudio(filePath, key)
}

// Deprecated: 使用 UploadTrace 代替
func UploadTraceToQiniu(filePath, key string) error {
	return UploadTrace(filePath, key)
}

// Deprecated: 使用 UpdateCallLogDetails 代替
func UpdateCallLogDetailsQiniu() {
	UpdateCallLogDetails()
}
