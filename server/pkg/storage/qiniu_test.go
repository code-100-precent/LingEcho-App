package stores

import (
	"bytes"
	"io"
	"os"
	"strings"
	"testing"
	"time"
)

// --- helpers ---

func newTestQiNiuStoreWithDomain(domain string, private bool) *QiNiuStore {
	return &QiNiuStore{
		AccessKey:  mustEnv("QINIU_ACCESS_KEY"),
		SecretKey:  mustEnv("QINIU_SECRET_KEY"),
		BucketName: mustEnv("QINIU_BUCKET"),
		Domain:     domain,
		Private:    private,
		Region:     mustEnv("QINIU_REGION"),
	}
}

func readAll(t *testing.T, r io.Reader) string {
	t.Helper()
	b, err := io.ReadAll(r)
	if err != nil {
		t.Fatalf("readAll err: %v", err)
	}
	return string(b)
}

// --- integration tests: 需要配置环境变量，否者自动跳过 ---
// 需要的环境变量：QINIU_ACCESS_KEY, QINIU_SECRET_KEY, QINIU_BUCKET, QINIU_DOMAIN
// 可选：QINIU_PRIVATE, QINIU_REGION
// 这些测试会真实上传/查询/下载/删除一个临时 Key：test-go-lingecho/<timestamp>.txt

func mustEnv(k string) string {
	v := os.Getenv(k)
	if v == "" {
		panic("missing env: " + k)
	}
	return v
}

func integrationEnvReady() bool {
	_, a := os.LookupEnv("QINIU_ACCESS_KEY")
	_, b := os.LookupEnv("QINIU_SECRET_KEY")
	_, c := os.LookupEnv("QINIU_BUCKET")
	_, d := os.LookupEnv("QINIU_DOMAIN")
	return a && b && c && d
}

func TestIntegration_QiNiu_CRUD(t *testing.T) {
	if !integrationEnvReady() {
		t.Skip("skip integration test: QINIU_* env not fully set")
	}

	private := strings.EqualFold(os.Getenv("QINIU_PRIVATE"), "true")
	store := &QiNiuStore{
		AccessKey:  mustEnv("QINIU_ACCESS_KEY"),
		SecretKey:  mustEnv("QINIU_SECRET_KEY"),
		BucketName: mustEnv("QINIU_BUCKET"),
		Domain:     mustEnv("QINIU_DOMAIN"),
		Private:    private,
		Region:     mustEnv("QINIU_REGION"),
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
