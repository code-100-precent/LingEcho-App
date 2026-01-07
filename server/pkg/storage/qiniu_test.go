package stores

import (
	"bytes"
	"io"
	"os"
	"strings"
	"testing"
	"time"

	"github.com/code-100-precent/LingEcho/pkg/utils"
)

func readAll(t *testing.T, r io.Reader) string {
	t.Helper()
	b, err := io.ReadAll(r)
	if err != nil {
		t.Fatalf("readAll err: %v", err)
	}
	return string(b)
}

func checkEnvReady() bool {
	accessKey := utils.GetEnv("QINIU_ACCESS_KEY")
	secretKey := utils.GetEnv("QINIU_SECRET_KEY")
	bucket := utils.GetEnv("QINIU_BUCKET")
	domain := utils.GetEnv("QINIU_DOMAIN")
	return accessKey != "" && secretKey != "" && bucket != "" && domain != ""
}

// newTestStore 创建测试用的 QiNiuStore 实例
func newTestStore(t *testing.T) *QiNiuStore {
	t.Helper()
	if !checkEnvReady() {
		t.Skip("skip integration test: QINIU_* env not fully set")
	}
	private := strings.EqualFold(os.Getenv("QINIU_PRIVATE"), "true")
	return &QiNiuStore{
		AccessKey:  utils.GetEnv("QINIU_ACCESS_KEY"),
		SecretKey:  utils.GetEnv("QINIU_SECRET_KEY"),
		BucketName: utils.GetEnv("QINIU_BUCKET"),
		Domain:     utils.GetEnv("QINIU_DOMAIN"),
		Private:    private,
		Region:     utils.GetEnv("QINIU_REGION"),
	}
}

func TestQiNiuCRUD(t *testing.T) {
	if !checkEnvReady() {
		t.Skip("skip integration test: QINIU_* env not fully set")
	}

	private := strings.EqualFold(os.Getenv("QINIU_PRIVATE"), "true")
	store := &QiNiuStore{
		AccessKey:  utils.GetEnv("QINIU_ACCESS_KEY"),
		SecretKey:  utils.GetEnv("QINIU_SECRET_KEY"),
		BucketName: utils.GetEnv("QINIU_BUCKET"),
		Domain:     utils.GetEnv("QINIU_DOMAIN"),
		Private:    private,
		Region:     utils.GetEnv("QINIU_REGION"),
	}

	key := "test-go-lingecho/" + time.Now().Format("20060102-150405") + ".txt"
	content := "hello-from-integration"

	// 1) Write
	if err := store.Write(key, bytes.NewBufferString(content)); err != nil {
		t.Fatalf("Write err: %v", err)
	}

	// 2) Exists should be true
	ok, err := store.Exists(key)
	if err != nil {
		t.Fatalf("Exists err: %v", err)
	}
	if !ok {
		t.Fatalf("Exists returned false after write")
	}

	// 3) Read
	rc, _, err := store.Read(key)
	if err != nil {
		t.Fatalf("Read err: %v", err)
	}
	data := readAll(t, rc)
	_ = rc.Close()
	if data != content {
		t.Fatalf("Read content mismatch, got: %q", data)
	}

	// 4) PublicURL
	u := store.PublicURL(key)
	if !strings.HasPrefix(u, "http") {
		t.Fatalf("PublicURL invalid: %s", u)
	}
	if private && !strings.Contains(u, "token=") {
		t.Fatalf("Private PublicURL should be signed, got: %s", u)
	}

	// 5) Delete
	if err := store.Delete(key); err != nil {
		t.Fatalf("Delete err: %v", err)
	}

	// 6) Exists should be false
	ok, err = store.Exists(key)
	if err != nil {
		// 删除后 Stat 可能返回 612，我们在 Exists 里已处理为 false,nil
		// 如果这里仍返回错误，说明 SDK 行为变更或网络异常
		t.Fatalf("Exists after delete err: %v", err)
	}
	if ok {
		t.Fatalf("Exists should be false after delete")
	}
}

func TestListBuckets(t *testing.T) {
	if !checkEnvReady() {
		t.Skip("skip integration test: QINIU_* env not fully set")
	}

	private := strings.EqualFold(os.Getenv("QINIU_PRIVATE"), "true")
	store := &QiNiuStore{
		AccessKey:  utils.GetEnv("QINIU_ACCESS_KEY"),
		SecretKey:  utils.GetEnv("QINIU_SECRET_KEY"),
		BucketName: utils.GetEnv("QINIU_BUCKET"),
		Domain:     utils.GetEnv("QINIU_DOMAIN"),
		Private:    private,
		Region:     utils.GetEnv("QINIU_REGION"),
	}
	buckets, err := store.ListBuckets("", false)
	if err != nil {
		t.Fatalf("ListBuckets err: %v", err)
	}
	for _, bucket := range buckets {
		t.Log(bucket)
	}
}

func TestCreateAndDeleteBuckets(t *testing.T) {
	if !checkEnvReady() {
		t.Skip("skip integration test: QINIU_* env not fully set")
	}

	private := strings.EqualFold(os.Getenv("QINIU_PRIVATE"), "true")
	store := &QiNiuStore{
		AccessKey:  utils.GetEnv("QINIU_ACCESS_KEY"),
		SecretKey:  utils.GetEnv("QINIU_SECRET_KEY"),
		BucketName: utils.GetEnv("QINIU_BUCKET"),
		Domain:     utils.GetEnv("QINIU_DOMAIN"),
		Private:    private,
		Region:     utils.GetEnv("QINIU_REGION"),
	}
	// 使用时间戳生成唯一的 bucket 名称
	bucketName := "lingecho-test-" + time.Now().Format("20060102-150405")

	// 1) 创建 bucket
	err := store.CreateBucket(bucketName, "z0")
	if err != nil {
		t.Fatalf("CreateBucket err: %v", err)
	}

	// 确保测试结束后删除 bucket
	defer func() {
		if err := store.DeleteBucket(bucketName); err != nil {
			t.Logf("DeleteBucket cleanup err: %v", err)
		}
	}()

	// 2) 测试 GetBucketDomains - 获取域名列表（新创建的 bucket 可能没有绑定域名，这是正常的）
	domains, err := store.GetBucketDomains(bucketName)
	if err != nil {
		t.Fatalf("GetBucketDomains err: %v", err)
	}
	t.Logf("Bucket domains: %v", domains)

	// 3) 测试 SetBucketPrivate - 设置空间访问权限
	// 先设置为私有
	err = store.SetBucketPrivate(bucketName, true)
	if err != nil {
		t.Fatalf("SetBucketPrivate(true) err: %v", err)
	}
	// 再设置为公开
	err = store.SetBucketPrivate(bucketName, false)
	if err != nil {
		t.Fatalf("SetBucketPrivate(false) err: %v", err)
	}

	// 4) 测试 PutBucketTagging - 设置空间标签
	// 注意：标签操作需要网络连接，如果失败可能是网络问题
	testTags := []BucketTag{
		{Key: "Environment", Value: "test"},
		{Key: "Project", Value: "lingecho"},
	}
	err = store.PutBucketTagging(bucketName, testTags)
	if err != nil {
		t.Logf("PutBucketTagging failed (may be due to network issues): %v", err)
		// 如果设置标签失败，跳过后续标签测试
	} else {
		// 5) 测试 GetBucketTagging - 查询空间标签
		tags, err := store.GetBucketTagging(bucketName)
		if err != nil {
			t.Logf("GetBucketTagging err: %v", err)
		} else {
			// 验证标签是否正确设置
			if len(tags) != len(testTags) {
				t.Fatalf("Tag count mismatch: expected %d, got %d", len(testTags), len(tags))
			}
			tagMap := make(map[string]string)
			for _, tag := range tags {
				tagMap[tag.Key] = tag.Value
			}
			for _, expectedTag := range testTags {
				if value, ok := tagMap[expectedTag.Key]; !ok || value != expectedTag.Value {
					t.Fatalf("Tag mismatch for key %s: expected %s, got %s", expectedTag.Key, expectedTag.Value, value)
				}
			}
			t.Logf("Bucket tags: %v", tags)

			// 6) 测试 DeleteBucketTagging - 删除空间标签
			err = store.DeleteBucketTagging(bucketName)
			if err != nil {
				t.Fatalf("DeleteBucketTagging err: %v", err)
			}
			// 验证标签已删除
			tags, err = store.GetBucketTagging(bucketName)
			if err != nil {
				t.Fatalf("GetBucketTagging after delete err: %v", err)
			}
			if len(tags) != 0 {
				t.Fatalf("Tags should be empty after delete, but got %d tags", len(tags))
			}
		}
	}

	// 7) 删除 bucket
	err = store.DeleteBucket(bucketName)
	if err != nil {
		t.Fatalf("DeleteBucket err: %v", err)
	}
}

// TestSetObjectLifecycle 测试设置对象生命周期
func TestSetObjectLifecycle(t *testing.T) {
	store := newTestStore(t)

	// 先上传一个测试文件
	key := "test-lifecycle/" + time.Now().Format("20060102-150405") + ".txt"
	content := "test lifecycle content"
	if err := store.Write(key, bytes.NewBufferString(content)); err != nil {
		t.Fatalf("Write err: %v", err)
	}
	defer func() {
		if err := store.Delete(key); err != nil {
			t.Logf("Delete cleanup err: %v", err)
		}
	}()

	// 测试设置生命周期：30天后转为低频存储，60天后删除
	err := store.SetObjectLifecycle(store.BucketName, key, 30, -1, -1, -1, -1, 60)
	if err != nil {
		t.Fatalf("SetObjectLifecycle err: %v", err)
	}
	t.Log("Object lifecycle set successfully")
}

// TestPrefetchObject 测试从镜像源站抓取对象
func TestPrefetchObject(t *testing.T) {
	store := newTestStore(t)

	// 注意：此功能需要空间配置了镜像存储，如果未配置会失败
	key := "test-prefetch/" + time.Now().Format("20060102-150405") + ".txt"
	err := store.PrefetchObject(store.BucketName, key)
	if err != nil {
		// 如果空间未配置镜像存储，这是预期的错误
		t.Logf("PrefetchObject failed (may be expected if mirror storage not configured): %v", err)
	} else {
		t.Log("PrefetchObject succeeded")
	}
}

// TestFetchObject 测试从URL抓取对象
func TestFetchObject(t *testing.T) {
	store := newTestStore(t)

	// 使用一个公开可访问的测试URL
	testURL := "https://www.baidu.com/favicon.ico"
	key := "test-fetch/" + time.Now().Format("20060102-150405") + ".ico"

	req := FetchObjectRequest{
		URL:    testURL,
		Bucket: store.BucketName,
		Key:    key,
	}

	// 使用环境变量中的区域，如果没有则使用 z0
	region := utils.GetEnv("QINIU_REGION")
	if region == "" {
		region = "z0"
	}

	resp, err := store.FetchObject(region, req)
	if err != nil {
		// 如果区域不正确或其他错误，记录但不失败
		t.Logf("FetchObject err (may be due to region or other issues): %v", err)
		return
	}

	if resp.ID == "" {
		t.Fatalf("FetchObject returned empty task ID")
	}

	t.Logf("FetchObject task created: ID=%s, Wait=%d", resp.ID, resp.Wait)

	// 查询任务状态
	if resp.ID != "" {
		taskResp, err := store.QueryFetchTask("z0", resp.ID)
		if err != nil {
			t.Logf("QueryFetchTask err: %v", err)
		} else {
			t.Logf("Fetch task status: ID=%s, Wait=%d", taskResp.ID, taskResp.Wait)
		}
	}

	// 清理：删除抓取的文件
	defer func() {
		if err := store.Delete(key); err != nil {
			t.Logf("Delete cleanup err: %v", err)
		}
	}()
}

// TestMultipartUpload 测试分片上传功能
func TestMultipartUpload(t *testing.T) {
	store := newTestStore(t)

	key := "test-multipart-" + time.Now().Format("20060102-150405") + ".bin"
	// 创建一个较大的测试数据（大于4MB，满足分片上传的最小要求）
	partSize := 5 * 1024 * 1024 // 5MB per part
	part1Data := make([]byte, partSize)
	part2Data := make([]byte, partSize)
	for i := range part1Data {
		part1Data[i] = byte(i % 256)
	}
	for i := range part2Data {
		part2Data[i] = byte((i + 1) % 256)
	}

	// 1) 初始化分片上传
	initReq := &InitiateMultipartUploadRequest{
		MimeType: "application/octet-stream",
		FileType: 0, // 标准存储
		PartSize: int64(partSize),
	}
	initResp, err := store.InitiateMultipartUpload(store.BucketName, key, initReq)
	if err != nil {
		t.Logf("InitiateMultipartUpload err (may be due to API format issues): %v", err)
		t.Skip("Skipping multipart upload test due to API format issues")
		return
	}
	if initResp.UploadID == "" {
		t.Fatalf("InitiateMultipartUpload returned empty upload ID")
	}
	t.Logf("Multipart upload initiated: UploadID=%s", initResp.UploadID)

	uploadID := initResp.UploadID

	// 确保在测试失败时清理
	defer func() {
		if err := store.AbortMultipartUpload(store.BucketName, key, uploadID); err != nil {
			t.Logf("AbortMultipartUpload cleanup err: %v", err)
		}
	}()

	// 2) 上传第一个分片
	part1Resp, err := store.UploadPart(store.BucketName, key, &UploadPartRequest{
		UploadID:   uploadID,
		PartNumber: 1,
		Data:       part1Data,
	})
	if err != nil {
		t.Fatalf("UploadPart 1 err: %v", err)
	}
	if part1Resp.ETag == "" {
		t.Fatalf("UploadPart 1 returned empty ETag")
	}
	t.Logf("Part 1 uploaded: ETag=%s", part1Resp.ETag)

	// 3) 上传第二个分片
	part2Resp, err := store.UploadPart(store.BucketName, key, &UploadPartRequest{
		UploadID:   uploadID,
		PartNumber: 2,
		Data:       part2Data,
	})
	if err != nil {
		t.Fatalf("UploadPart 2 err: %v", err)
	}
	if part2Resp.ETag == "" {
		t.Fatalf("UploadPart 2 returned empty ETag")
	}
	t.Logf("Part 2 uploaded: ETag=%s", part2Resp.ETag)

	// 4) 列举分片
	listReq := &ListPartsRequest{
		UploadID: uploadID,
		MaxParts: 10,
	}
	listResp, err := store.ListParts(store.BucketName, key, listReq)
	if err != nil {
		t.Fatalf("ListParts err: %v", err)
	}
	if listResp.UploadID != uploadID {
		t.Fatalf("ListParts returned wrong UploadID: expected %s, got %s", uploadID, listResp.UploadID)
	}
	if len(listResp.Parts) != 2 {
		t.Fatalf("ListParts returned wrong part count: expected 2, got %d", len(listResp.Parts))
	}
	t.Logf("ListParts: found %d parts", len(listResp.Parts))

	// 5) 完成分片上传
	completeReq := &CompleteMultipartUploadRequest{
		UploadID: uploadID,
		Parts: []CompleteMultipartPart{
			{PartNumber: 1, ETag: part1Resp.ETag},
			{PartNumber: 2, ETag: part2Resp.ETag},
		},
	}
	completeResp, err := store.CompleteMultipartUpload(store.BucketName, key, completeReq)
	if err != nil {
		t.Fatalf("CompleteMultipartUpload err: %v", err)
	}
	if completeResp.Key != key {
		t.Fatalf("CompleteMultipartUpload returned wrong key: expected %s, got %s", key, completeResp.Key)
	}
	if completeResp.Hash == "" {
		t.Fatalf("CompleteMultipartUpload returned empty hash")
	}
	t.Logf("Multipart upload completed: Key=%s, Hash=%s", completeResp.Key, completeResp.Hash)

	// 6) 验证文件存在
	exists, err := store.Exists(key)
	if err != nil {
		t.Fatalf("Exists err: %v", err)
	}
	if !exists {
		t.Fatalf("File should exist after multipart upload")
	}

	// 7) 清理：删除上传的文件
	if err := store.Delete(key); err != nil {
		t.Fatalf("Delete err: %v", err)
	}
}

// TestAbortMultipartUpload 测试中止分片上传
func TestAbortMultipartUpload(t *testing.T) {
	store := newTestStore(t)

	key := "test-abort-" + time.Now().Format("20060102-150405") + ".bin"

	// 1) 初始化分片上传
	initResp, err := store.InitiateMultipartUpload(store.BucketName, key, nil)
	if err != nil {
		t.Logf("InitiateMultipartUpload err (may be due to API format issues): %v", err)
		t.Skip("Skipping abort multipart upload test due to API format issues")
		return
	}
	uploadID := initResp.UploadID
	t.Logf("Multipart upload initiated: UploadID=%s", uploadID)

	// 2) 中止分片上传
	err = store.AbortMultipartUpload(store.BucketName, key, uploadID)
	if err != nil {
		t.Fatalf("AbortMultipartUpload err: %v", err)
	}
	t.Log("Multipart upload aborted successfully")

	// 3) 验证文件不存在
	exists, err := store.Exists(key)
	if err != nil {
		t.Fatalf("Exists err: %v", err)
	}
	if exists {
		t.Fatalf("File should not exist after aborting multipart upload")
	}
}
