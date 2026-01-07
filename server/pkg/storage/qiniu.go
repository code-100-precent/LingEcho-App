package stores

import (
	"bytes"
	"context"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strconv"
	"strings"
	"time"

	"github.com/code-100-precent/LingEcho/pkg/utils"
	"github.com/code-100-precent/LingEcho/pkg/utils/qiniu/auth"
	"github.com/qiniu/go-sdk/v7/auth/qbox"
	"github.com/qiniu/go-sdk/v7/storage"
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
	// 注意：GetRegion 可能需要网络连接，如果失败（如 DNS 解析失败），会返回错误
	// 此时 cfg.Region 为 nil，SDK 会在首次请求时尝试自动发现区域
	if zone, err := storage.GetRegion(q.AccessKey, q.BucketName); err == nil && zone != nil {
		cfg.Region = zone
	}
	// 如需强制区域，可在此依据 q.Region 设置 cfg.Region = &storage.RegionHuadong 等
	// 如果 q.Region 环境变量已设置，可以根据值手动设置区域（需要导入对应的区域常量）
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

// BucketTag 表示一个标签键值对
type BucketTag struct {
	Key   string `json:"Key"`
	Value string `json:"Value"`
}

// BucketTagging 表示Bucket的标签集合
type BucketTagging struct {
	Tags []BucketTag `json:"Tags"`
}

// ListBuckets 列举请求者拥有的所有Bucket
// tagCondition: 可选，过滤空间的标签或标签值条件，必须做URL安全的Base64编码
// shared: 是否包含共享空间
func (q *QiNiuStore) ListBuckets(tagCondition string, shared bool) ([]string, error) {
	// 如果没有标签条件，先尝试使用 SDK 的 Buckets 方法
	if tagCondition == "" {
		cfg := q.makeConfig()
		bm := storage.NewBucketManager(q.getMac(), &cfg)
		buckets, err := bm.Buckets(shared)
		// 如果 SDK 方法成功，直接返回
		if err == nil {
			return buckets, nil
		}
		// 如果 SDK 方法失败（可能是网络问题或区域探测失败），回退到 HTTP API
		// 继续执行下面的 HTTP API 调用
	}

	// 使用 HTTP API（适用于有标签条件或 SDK 方法失败的情况）
	path := "/buckets"
	rawQuery := ""
	if tagCondition != "" {
		rawQuery = "tagCondition=" + url.QueryEscape(tagCondition)
	}
	if shared {
		if rawQuery != "" {
			rawQuery += "&"
		}
		rawQuery += "shared=true"
	}

	resp, err := q.makeAPICall("GET", "uc.qiniuapi.com", path, rawQuery, "", nil)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, q.parseError(resp)
	}

	var buckets []string
	if err := json.NewDecoder(resp.Body).Decode(&buckets); err != nil {
		return nil, fmt.Errorf("failed to decode response: %w", err)
	}

	return buckets, nil
}

// CreateBucket 创建新的存储空间
// bucketName: 空间名称，要求在对象存储系统范围内唯一，由3～63个字符组成
// region: 存储区域ID，默认z0
func (q *QiNiuStore) CreateBucket(bucketName, region string) error {
	if region == "" {
		region = "z0"
	}

	// 先尝试使用 SDK 方法
	cfg := q.makeConfig()
	bm := storage.NewBucketManager(q.getMac(), &cfg)
	err := bm.CreateBucket(bucketName, storage.RegionID(region))
	if err == nil {
		return nil
	}
	path := fmt.Sprintf("/mkbucketv3/%s/region/%s", url.PathEscape(bucketName), url.PathEscape(region))
	resp, err := q.makeAPICall("POST", "uc.qiniuapi.com", path, "", "", nil)
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return q.parseError(resp)
	}

	return nil
}

// DeleteBucket 删除指定存储空间
// bucketName: 需要删除的目标空间名
func (q *QiNiuStore) DeleteBucket(bucketName string) error {
	// 先尝试使用 SDK 方法
	cfg := q.makeConfig()
	bm := storage.NewBucketManager(q.getMac(), &cfg)
	err := bm.DropBucket(bucketName)
	// 如果 SDK 方法成功，直接返回
	if err == nil {
		return nil
	}

	// 使用 HTTP API: POST /drop/<BucketName>
	path := fmt.Sprintf("/drop/%s", url.PathEscape(bucketName))
	resp, err := q.makeAPICall("POST", "uc.qiniuapi.com", path, "", "", nil)
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return q.parseError(resp)
	}

	return nil
}

// GetBucketDomains 获取一个空间绑定的所有域名列表
// bucketName: 要获取域名列表的目标空间名称
func (q *QiNiuStore) GetBucketDomains(bucketName string) ([]string, error) {
	// 先尝试使用 SDK 方法
	cfg := q.makeConfig()
	bm := storage.NewBucketManager(q.getMac(), &cfg)
	domainInfos, err := bm.ListBucketDomains(bucketName)
	if err == nil {
		domains := make([]string, len(domainInfos))
		for i, info := range domainInfos {
			domains[i] = info.Domain
		}
		return domains, nil
	}
	// 如果 SDK 方法失败，回退到 HTTP API

	// 使用 HTTP API: GET /v2/domains?tbl=<bucketName>
	path := "/v2/domains"
	rawQuery := "tbl=" + url.QueryEscape(bucketName)
	resp, err := q.makeAPICall("GET", "uc.qiniuapi.com", path, rawQuery, "", nil)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, q.parseError(resp)
	}

	var domains []string
	if err := json.NewDecoder(resp.Body).Decode(&domains); err != nil {
		return nil, fmt.Errorf("failed to decode response: %w", err)
	}

	return domains, nil
}

// SetBucketPrivate 设置空间访问权限
// bucketName: 空间名称
// isPrivate: true表示私有，false表示公开
func (q *QiNiuStore) SetBucketPrivate(bucketName string, isPrivate bool) error {
	// 先尝试使用 SDK 方法
	cfg := q.makeConfig()
	bm := storage.NewBucketManager(q.getMac(), &cfg)
	var err error
	if isPrivate {
		err = bm.MakeBucketPrivate(bucketName)
	} else {
		err = bm.MakeBucketPublic(bucketName)
	}
	if err == nil {
		return nil
	}
	// 如果 SDK 方法失败，回退到 HTTP API

	// 使用 HTTP API: POST /private?bucket=<bucketName>&private=<0|1>
	path := "/private"
	privateValue := "0"
	if isPrivate {
		privateValue = "1"
	}
	rawQuery := fmt.Sprintf("bucket=%s&private=%s", url.QueryEscape(bucketName), privateValue)
	resp, err := q.makeAPICall("POST", "uc.qiniuapi.com", path, rawQuery, "", nil)
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return q.parseError(resp)
	}

	return nil
}

// PutBucketTagging 设置空间标签
// bucketName: 空间名称
// tags: 标签列表，最多10对标签
func (q *QiNiuStore) PutBucketTagging(bucketName string, tags []BucketTag) error {
	// 转换为map[string]string
	tagMap := make(map[string]string)
	for _, tag := range tags {
		tagMap[tag.Key] = tag.Value
	}

	// 使用 SDK 方法（标签操作目前仅支持 SDK）
	cfg := q.makeConfig()
	bm := storage.NewBucketManager(q.getMac(), &cfg)
	return bm.SetTagging(bucketName, tagMap)
}

// GetBucketTagging 查询空间标签
// bucketName: 空间名称
func (q *QiNiuStore) GetBucketTagging(bucketName string) ([]BucketTag, error) {
	// 使用 SDK 方法（标签操作目前仅支持 SDK）
	cfg := q.makeConfig()
	bm := storage.NewBucketManager(q.getMac(), &cfg)
	tagMap, err := bm.GetTagging(bucketName)
	if err != nil {
		return nil, err
	}

	tags := make([]BucketTag, 0, len(tagMap))
	for k, v := range tagMap {
		tags = append(tags, BucketTag{Key: k, Value: v})
	}
	return tags, nil
}

// DeleteBucketTagging 删除空间标签
// bucketName: 空间名称
func (q *QiNiuStore) DeleteBucketTagging(bucketName string) error {
	// 使用 SDK 方法（标签操作目前仅支持 SDK）
	cfg := q.makeConfig()
	bm := storage.NewBucketManager(q.getMac(), &cfg)
	return bm.ClearTagging(bucketName)
}

// SetObjectLifecycle 修改已上传对象的生命周期
// bucketName: 空间名称
// key: 对象key
// toIAAfterDays: 转低频存储天数，-1表示取消
// toIntelligentTieringAfterDays: 转智能分层存储天数，-1表示取消
// toArchiveIRAfterDays: 转归档直读存储天数，-1表示取消
// toArchiveAfterDays: 转归档存储天数，-1表示取消
// toDeepArchiveAfterDays: 转深度归档存储天数，-1表示取消
// deleteAfterDays: 过期删除天数，-1表示取消
func (q *QiNiuStore) SetObjectLifecycle(bucketName, key string, toIAAfterDays, toIntelligentTieringAfterDays, toArchiveIRAfterDays, toArchiveAfterDays, toDeepArchiveAfterDays, deleteAfterDays int) error {
	// SDK没有此方法，使用HTTP API
	entryURI := base64.URLEncoding.EncodeToString([]byte(bucketName + ":" + key))
	path := fmt.Sprintf("/lifecycle/%s", entryURI)

	// 构建路径参数
	var pathParts []string
	if toIAAfterDays >= 0 {
		pathParts = append(pathParts, fmt.Sprintf("toIAAfterDays/%d", toIAAfterDays))
	}
	if toIntelligentTieringAfterDays >= 0 {
		pathParts = append(pathParts, fmt.Sprintf("toIntelligentTieringAfterDays/%d", toIntelligentTieringAfterDays))
	}
	if toArchiveIRAfterDays >= 0 {
		pathParts = append(pathParts, fmt.Sprintf("toArchiveIRAfterDays/%d", toArchiveIRAfterDays))
	}
	if toArchiveAfterDays >= 0 {
		pathParts = append(pathParts, fmt.Sprintf("toArchiveAfterDays/%d", toArchiveAfterDays))
	}
	if toDeepArchiveAfterDays >= 0 {
		pathParts = append(pathParts, fmt.Sprintf("toDeepArchiveAfterDays/%d", toDeepArchiveAfterDays))
	}
	if deleteAfterDays >= 0 {
		pathParts = append(pathParts, fmt.Sprintf("deleteAfterDays/%d", deleteAfterDays))
	}

	// 如果有参数，拼接路径
	if len(pathParts) > 0 {
		path = fmt.Sprintf("/lifecycle/%s/%s", entryURI, strings.Join(pathParts, "/"))
	}

	resp, err := q.makeAPICall("POST", "rs.qiniuapi.com", path, "", "", nil)
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return q.parseError(resp)
	}

	return nil
}

// PrefetchObject 对于设置了镜像存储的空间，从镜像源站抓取指定名称的对象并存储到该空间中
// bucketName: 空间名称
// key: 对象key
func (q *QiNiuStore) PrefetchObject(bucketName, key string) error {
	cfg := q.makeConfig()
	bm := storage.NewBucketManager(q.getMac(), &cfg)
	return bm.Prefetch(bucketName, key)
}

// FetchObjectRequest 异步第三方资源抓取请求参数
type FetchObjectRequest struct {
	URL              string `json:"url"`                        // 需要抓取的url，支持多个用;分隔
	Host             string `json:"host,omitempty"`             // 从指定url下载数据时使用的Host
	Bucket           string `json:"bucket"`                     // 所在区域的bucket
	Key              string `json:"key,omitempty"`              // 文件存储的key，不传则使用文件hash作为key
	MD5              string `json:"md5,omitempty"`              // 文件md5，传入以后会在存入存储时对文件做校验
	ETag             string `json:"etag,omitempty"`             // 文件etag，传入以后会在存入存储时对文件做校验
	CallbackURL      string `json:"callbackurl,omitempty"`      // 回调URL
	CallbackBody     string `json:"callbackbody,omitempty"`     // 回调Body
	CallbackBodyType string `json:"callbackbodytype,omitempty"` // 回调Body内容类型
	CallbackHost     string `json:"callbackhost,omitempty"`     // 回调时使用的Host
	FileType         int    `json:"file_type,omitempty"`        // 存储文件类型 0:标准存储, 1:低频存储, 2:归档存储, 3:深度归档存储, 4:归档直读存储, 5:智能分层存储
	Mode             string `json:"mode,omitempty"`             // 可选填入m3u8，此时会解析m3u8并下载对应ts落存储
	IgnoreSameKey    bool   `json:"ignore_same_key,omitempty"`  // 如果已存在同名文件是否重试抓取
}

// FetchObjectResponse 异步第三方资源抓取响应
type FetchObjectResponse struct {
	ID   string `json:"id"`   // 异步任务Id
	Wait int    `json:"wait"` // 当前任务前面的排队任务数量，0表示当前任务正在进行，-1表示任务已经至少被处理过一次
}

// FetchObject 从指定URL抓取对象，并将该对象存储到指定空间中
// region: 区域ID，如z0
// req: 抓取请求参数
func (q *QiNiuStore) FetchObject(region string, req FetchObjectRequest) (*FetchObjectResponse, error) {
	if region == "" {
		region = "z0"
	}
	host := fmt.Sprintf("api-%s.qiniuapi.com", region)
	path := "/sisyphus/fetch"

	body, err := json.Marshal(req)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal request: %w", err)
	}

	resp, err := q.makeAPICall("POST", host, path, "", "application/json", body)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, q.parseError(resp)
	}

	var result FetchObjectResponse
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return nil, fmt.Errorf("failed to decode response: %w", err)
	}

	return &result, nil
}

// QueryFetchTask 查询异步抓取任务状态
// region: 区域ID，如z0
// taskID: 异步任务ID
func (q *QiNiuStore) QueryFetchTask(region, taskID string) (*FetchObjectResponse, error) {
	if region == "" {
		region = "z0"
	}
	host := fmt.Sprintf("api-%s.qiniuapi.com", region)
	path := "/sisyphus/fetch"
	rawQuery := "id=" + url.QueryEscape(taskID)

	resp, err := q.makeAPICall("GET", host, path, rawQuery, "", nil)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, q.parseError(resp)
	}

	var result FetchObjectResponse
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return nil, fmt.Errorf("failed to decode response: %w", err)
	}

	return &result, nil
}

// ============================================================================
// Multipart Upload v2 API
// ============================================================================

// InitiateMultipartUploadRequest 初始化分片上传请求
type InitiateMultipartUploadRequest struct {
	Bucket   string            `json:"bucket"`             // 空间名称
	Key      string            `json:"key"`                // 对象key
	Meta     map[string]string `json:"meta,omitempty"`     // 自定义元数据
	MimeType string            `json:"mimeType,omitempty"` // MIME类型
	FileType int               `json:"fileType,omitempty"` // 存储类型 0:标准存储, 1:低频存储, 2:归档存储, 3:深度归档存储, 4:归档直读存储, 5:智能分层存储
	PartSize int64             `json:"partSize,omitempty"` // 分片大小，单位字节，最小4MB
}

// InitiateMultipartUploadResponse 初始化分片上传响应
type InitiateMultipartUploadResponse struct {
	UploadID string `json:"uploadId"` // 上传任务ID
}

// InitiateMultipartUpload 通知服务端开启分块上传任务，得到全局唯一任务UploadId
// bucketName: 空间名称
// key: 对象key
// req: 初始化请求参数
func (q *QiNiuStore) InitiateMultipartUpload(bucketName, key string, req *InitiateMultipartUploadRequest) (*InitiateMultipartUploadResponse, error) {
	if req == nil {
		req = &InitiateMultipartUploadRequest{}
	}
	req.Bucket = bucketName
	req.Key = key

	// 使用HTTP API初始化分片上传
	// 路径格式: /buckets/<BucketName>/objects/<EncodedObjectName>/uploads
	// 其中 EncodedObjectName 是 key 的 Base64 URL-safe 编码
	encodedKey := base64.URLEncoding.EncodeToString([]byte(key))
	path := fmt.Sprintf("/buckets/%s/objects/%s/uploads", bucketName, encodedKey)

	body, err := json.Marshal(req)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal request: %w", err)
	}

	resp, err := q.makeAPICall("POST", "rs.qiniuapi.com", path, "", "application/json", body)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, q.parseError(resp)
	}

	var result InitiateMultipartUploadResponse
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return nil, fmt.Errorf("failed to decode response: %w", err)
	}

	return &result, nil
}

// UploadPartRequest 分片上传请求
type UploadPartRequest struct {
	UploadID   string // 上传任务ID
	PartNumber int    // 分片序号，从1开始
	Data       []byte // 分片数据
}

// UploadPartResponse 分片上传响应
type UploadPartResponse struct {
	ETag string `json:"etag"` // 分片的ETag
}

// UploadPart 分块上传数据，需指定的任务UploadId
// bucketName: 空间名称
// key: 对象key
// req: 分片上传请求
func (q *QiNiuStore) UploadPart(bucketName, key string, req *UploadPartRequest) (*UploadPartResponse, error) {
	encodedKey := base64.URLEncoding.EncodeToString([]byte(key))
	path := fmt.Sprintf("/buckets/%s/objects/%s/uploads/%s/%d", bucketName, encodedKey, req.UploadID, req.PartNumber)

	resp, err := q.makeAPICall("PUT", "rs.qiniuapi.com", path, "", "application/octet-stream", req.Data)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, q.parseError(resp)
	}

	etag := resp.Header.Get("ETag")
	if etag == "" {
		return nil, fmt.Errorf("missing ETag in response")
	}

	return &UploadPartResponse{ETag: etag}, nil
}

// CompleteMultipartUploadRequest 完成分片上传请求
type CompleteMultipartUploadRequest struct {
	UploadID string                  // 上传任务ID
	Parts    []CompleteMultipartPart // 所有分片信息
}

// CompleteMultipartPart 分片信息
type CompleteMultipartPart struct {
	PartNumber int    `json:"partNumber"` // 分片序号
	ETag       string `json:"etag"`       // 分片的ETag
}

// CompleteMultipartUploadResponse 完成分片上传响应
type CompleteMultipartUploadResponse struct {
	Key  string `json:"key"`  // 对象key
	Hash string `json:"hash"` // 文件hash
}

// CompleteMultipartUpload 完成整个文件的分块上传，需指定的任务UploadId
// bucketName: 空间名称
// key: 对象key
// req: 完成上传请求
func (q *QiNiuStore) CompleteMultipartUpload(bucketName, key string, req *CompleteMultipartUploadRequest) (*CompleteMultipartUploadResponse, error) {
	encodedKey := base64.URLEncoding.EncodeToString([]byte(key))
	path := fmt.Sprintf("/buckets/%s/objects/%s/uploads/%s", bucketName, encodedKey, req.UploadID)

	body, err := json.Marshal(map[string]interface{}{
		"parts": req.Parts,
	})
	if err != nil {
		return nil, fmt.Errorf("failed to marshal request: %w", err)
	}

	resp, err := q.makeAPICall("POST", "rs.qiniuapi.com", path, "", "application/json", body)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, q.parseError(resp)
	}

	var result CompleteMultipartUploadResponse
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return nil, fmt.Errorf("failed to decode response: %w", err)
	}

	return &result, nil
}

// AbortMultipartUpload 中止分块上传任务，并且删除已经上传的块，需指定的任务UploadId
// bucketName: 空间名称
// key: 对象key
// uploadID: 上传任务ID
func (q *QiNiuStore) AbortMultipartUpload(bucketName, key, uploadID string) error {
	encodedKey := base64.URLEncoding.EncodeToString([]byte(key))
	path := fmt.Sprintf("/buckets/%s/objects/%s/uploads/%s", bucketName, url.PathEscape(encodedKey), uploadID)

	resp, err := q.makeAPICall("DELETE", "rs.qiniuapi.com", path, "", "", nil)
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK && resp.StatusCode != http.StatusNoContent {
		return q.parseError(resp)
	}

	return nil
}

// ListPartsRequest 列举分片请求
type ListPartsRequest struct {
	UploadID         string // 上传任务ID
	PartNumberMarker int    // 分片序号标记，从该标记之后开始列举
	MaxParts         int    // 最大返回分片数量
}

// ListPartsResponse 列举分片响应
type ListPartsResponse struct {
	UploadID         string                  `json:"uploadId"`         // 上传任务ID
	PartNumberMarker int                     `json:"partNumberMarker"` // 下一个分片序号标记
	IsTruncated      bool                    `json:"isTruncated"`      // 是否还有更多分片
	Parts            []CompleteMultipartPart `json:"parts"`            // 分片列表
}

// ListParts 列举指定UploadId所属的所有已经上传成功Part
// bucketName: 空间名称
// key: 对象key
// req: 列举请求
func (q *QiNiuStore) ListParts(bucketName, key string, req *ListPartsRequest) (*ListPartsResponse, error) {
	encodedKey := base64.URLEncoding.EncodeToString([]byte(key))
	path := fmt.Sprintf("/buckets/%s/objects/%s/uploads/%s", bucketName, encodedKey, req.UploadID)

	rawQuery := ""
	if req.PartNumberMarker > 0 {
		rawQuery += fmt.Sprintf("partNumberMarker=%d", req.PartNumberMarker)
	}
	if req.MaxParts > 0 {
		if rawQuery != "" {
			rawQuery += "&"
		}
		rawQuery += fmt.Sprintf("maxParts=%d", req.MaxParts)
	}

	resp, err := q.makeAPICall("GET", "rs.qiniuapi.com", path, rawQuery, "", nil)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, q.parseError(resp)
	}

	var result ListPartsResponse
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return nil, fmt.Errorf("failed to decode response: %w", err)
	}

	return &result, nil
}

// makeAPICall 执行带签名的HTTP API调用
func (q *QiNiuStore) makeAPICall(method, host, path, rawQuery, contentType string, body []byte) (*http.Response, error) {
	// 构造请求
	urlStr := "https://" + host + path
	if rawQuery != "" {
		urlStr += "?" + rawQuery
	}

	var reqBody io.Reader
	if body != nil {
		reqBody = bytes.NewReader(body)
	}

	req, err := http.NewRequest(method, urlStr, reqBody)
	if err != nil {
		return nil, fmt.Errorf("failed to create request: %w", err)
	}

	// 设置请求头
	req.Header.Set("Host", host)
	if contentType != "" {
		req.Header.Set("Content-Type", contentType)
	}

	// 生成签名
	authReq := auth.QiniuAuthRequest{
		Method:      method,
		Path:        path,
		RawQuery:    rawQuery,
		Host:        host,
		ContentType: contentType,
		Body:        body,
	}
	token, err := auth.GenerateQiniuToken(q.AccessKey, q.SecretKey, authReq)
	if err != nil {
		return nil, fmt.Errorf("failed to generate token: %w", err)
	}
	req.Header.Set("Authorization", token)

	// 发送请求
	client := &http.Client{Timeout: 30 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("failed to send request: %w", err)
	}

	return resp, nil
}

// parseError 解析HTTP响应错误
func (q *QiNiuStore) parseError(resp *http.Response) error {
	bodyBytes, err := io.ReadAll(resp.Body)
	if err != nil {
		return &utils.Error{Code: resp.StatusCode, Message: fmt.Sprintf("HTTP %d", resp.StatusCode)}
	}

	// 尝试解析JSON错误响应
	var errResp struct {
		Error string `json:"error"`
	}
	if err := json.Unmarshal(bodyBytes, &errResp); err == nil && errResp.Error != "" {
		return &utils.Error{Code: resp.StatusCode, Message: errResp.Error}
	}

	// 如果不是JSON格式，返回原始响应
	return &utils.Error{Code: resp.StatusCode, Message: string(bodyBytes)}
}
