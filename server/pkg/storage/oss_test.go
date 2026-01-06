package stores

import (
	"bytes"
	"io"
	"os"
	"strings"
	"testing"
	"time"
)

// integrationEnvReady checks if OSS integration test environment variables are set
func ossIntegrationEnvReady() bool {
	_, a := os.LookupEnv("OSS_ACCESS_KEY_ID")
	_, b := os.LookupEnv("OSS_ACCESS_KEY_SECRET")
	_, c := os.LookupEnv("OSS_BUCKET")
	_, d := os.LookupEnv("OSS_ENDPOINT")
	return a && b && c && d
}

// mustEnv gets environment variable or panics if not set
func ossMustEnv(k string) string {
	v := os.Getenv(k)
	if v == "" {
		panic("missing env: " + k)
	}
	return v
}

// readAll reads all data from reader
func ossReadAll(t *testing.T, r io.Reader) string {
	t.Helper()
	b, err := io.ReadAll(r)
	if err != nil {
		t.Fatalf("readAll err: %v", err)
	}
	return string(b)
}

// TestIntegration_OSS_CRUD performs integration test for OSS storage
// Required environment variables: OSS_ACCESS_KEY_ID, OSS_ACCESS_KEY_SECRET, OSS_BUCKET, OSS_ENDPOINT
// Optional: OSS_DOMAIN, OSS_USE_HTTPS
// This test will actually upload/query/download/delete a temporary key: test-go-lingecho/<timestamp>.txt
func TestIntegration_OSS_CRUD(t *testing.T) {
	if !ossIntegrationEnvReady() {
		t.Skip("skip integration test: OSS_* env not fully set")
	}

	useHTTPS := strings.ToLower(os.Getenv("OSS_USE_HTTPS")) == "true" || os.Getenv("OSS_USE_HTTPS") == "1"
	store := &OSSStore{
		Endpoint:        ossMustEnv("OSS_ENDPOINT"),
		AccessKeyID:     ossMustEnv("OSS_ACCESS_KEY_ID"),
		AccessKeySecret: ossMustEnv("OSS_ACCESS_KEY_SECRET"),
		BucketName:      ossMustEnv("OSS_BUCKET"),
		Domain:          os.Getenv("OSS_DOMAIN"),
		UseHTTPS:        useHTTPS,
	}

	key := "test-go-lingecho/" + time.Now().Format("20060102-150405") + ".txt"
	content := "hello-from-oss-integration-test"

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
	rc, size, err := store.Read(key)
	if err != nil {
		t.Fatalf("Read err: %v", err)
	}
	defer rc.Close()

	if size != int64(len(content)) {
		t.Fatalf("Read size mismatch, got: %d, want: %d", size, len(content))
	}

	data := ossReadAll(t, rc)
	if data != content {
		t.Fatalf("Read content mismatch, got: %q, want: %q", data, content)
	}

	// 4) PublicURL
	u := store.PublicURL(key)
	if u == "" {
		t.Fatalf("PublicURL returned empty string")
	}
	if !strings.HasPrefix(u, "http://") && !strings.HasPrefix(u, "https://") {
		t.Fatalf("PublicURL should start with http:// or https://, got: %s", u)
	}
	if !strings.Contains(u, key) {
		t.Fatalf("PublicURL should contain key, got: %s", u)
	}

	// 5) Delete
	if err := store.Delete(key); err != nil {
		t.Fatalf("Delete err: %v", err)
	}

	// 6) Exists should be false
	ok, err = store.Exists(key)
	if err != nil {
		t.Fatalf("Exists after delete err: %v", err)
	}
	if ok {
		t.Fatalf("Exists should be false after delete")
	}
}

// TestOSSStore_PublicURL tests PublicURL generation with different configurations
func TestOSSStore_PublicURL(t *testing.T) {
	// Test with custom domain
	store1 := &OSSStore{
		Endpoint:   "oss-cn-hangzhou.aliyuncs.com",
		BucketName: "test-bucket",
		Domain:     "https://cdn.example.com",
		UseHTTPS:   true,
	}
	u1 := store1.PublicURL("path/to/file.txt")
	expected1 := "https://cdn.example.com/path/to/file.txt"
	if u1 != expected1 {
		t.Fatalf("PublicURL with custom domain got %q, want %q", u1, expected1)
	}

	// Test with domain without protocol
	store2 := &OSSStore{
		Endpoint:   "oss-cn-hangzhou.aliyuncs.com",
		BucketName: "test-bucket",
		Domain:     "cdn.example.com",
		UseHTTPS:   true,
	}
	u2 := store2.PublicURL("file.txt")
	if !strings.HasPrefix(u2, "https://") {
		t.Fatalf("PublicURL should add https:// prefix, got: %s", u2)
	}

	// Test without custom domain (use OSS endpoint)
	store3 := &OSSStore{
		Endpoint:   "oss-cn-hangzhou.aliyuncs.com",
		BucketName: "test-bucket",
		UseHTTPS:   true,
	}
	u3 := store3.PublicURL("path/file.txt")
	expected3 := "https://test-bucket.oss-cn-hangzhou.aliyuncs.com/path/file.txt"
	if u3 != expected3 {
		t.Fatalf("PublicURL without custom domain got %q, want %q", u3, expected3)
	}

	// Test with HTTP
	store4 := &OSSStore{
		Endpoint:   "oss-cn-hangzhou.aliyuncs.com",
		BucketName: "test-bucket",
		UseHTTPS:   false,
	}
	u4 := store4.PublicURL("file.txt")
	if !strings.HasPrefix(u4, "http://") {
		t.Fatalf("PublicURL with UseHTTPS=false should use http://, got: %s", u4)
	}
}

// TestNewOSSStore tests OSS store creation from environment variables
func TestNewOSSStore(t *testing.T) {
	// Save original env
	origEndpoint := os.Getenv("OSS_ENDPOINT")
	origKeyID := os.Getenv("OSS_ACCESS_KEY_ID")
	origSecret := os.Getenv("OSS_ACCESS_KEY_SECRET")
	origBucket := os.Getenv("OSS_BUCKET")
	origDomain := os.Getenv("OSS_DOMAIN")
	origHTTPS := os.Getenv("OSS_USE_HTTPS")

	// Restore env after test
	defer func() {
		if origEndpoint != "" {
			os.Setenv("OSS_ENDPOINT", origEndpoint)
		} else {
			os.Unsetenv("OSS_ENDPOINT")
		}
		if origKeyID != "" {
			os.Setenv("OSS_ACCESS_KEY_ID", origKeyID)
		} else {
			os.Unsetenv("OSS_ACCESS_KEY_ID")
		}
		if origSecret != "" {
			os.Setenv("OSS_ACCESS_KEY_SECRET", origSecret)
		} else {
			os.Unsetenv("OSS_ACCESS_KEY_SECRET")
		}
		if origBucket != "" {
			os.Setenv("OSS_BUCKET", origBucket)
		} else {
			os.Unsetenv("OSS_BUCKET")
		}
		if origDomain != "" {
			os.Setenv("OSS_DOMAIN", origDomain)
		} else {
			os.Unsetenv("OSS_DOMAIN")
		}
		if origHTTPS != "" {
			os.Setenv("OSS_USE_HTTPS", origHTTPS)
		} else {
			os.Unsetenv("OSS_USE_HTTPS")
		}
	}()

	// Test with HTTPS enabled
	os.Setenv("OSS_ENDPOINT", "oss-cn-hangzhou.aliyuncs.com")
	os.Setenv("OSS_ACCESS_KEY_ID", "test-key-id")
	os.Setenv("OSS_ACCESS_KEY_SECRET", "test-secret")
	os.Setenv("OSS_BUCKET", "test-bucket")
	os.Setenv("OSS_DOMAIN", "https://cdn.example.com")
	os.Setenv("OSS_USE_HTTPS", "true")

	store := NewOSSStore().(*OSSStore)
	if store.Endpoint != "oss-cn-hangzhou.aliyuncs.com" {
		t.Fatalf("Endpoint mismatch: %s", store.Endpoint)
	}
	if store.AccessKeyID != "test-key-id" {
		t.Fatalf("AccessKeyID mismatch: %s", store.AccessKeyID)
	}
	if store.AccessKeySecret != "test-secret" {
		t.Fatalf("AccessKeySecret mismatch")
	}
	if store.BucketName != "test-bucket" {
		t.Fatalf("BucketName mismatch: %s", store.BucketName)
	}
	if store.Domain != "https://cdn.example.com" {
		t.Fatalf("Domain mismatch: %s", store.Domain)
	}
	if !store.UseHTTPS {
		t.Fatalf("UseHTTPS should be true")
	}

	// Test with HTTPS disabled
	os.Setenv("OSS_USE_HTTPS", "false")
	store2 := NewOSSStore().(*OSSStore)
	if store2.UseHTTPS {
		t.Fatalf("UseHTTPS should be false")
	}

	// Test with "1" as true
	os.Setenv("OSS_USE_HTTPS", "1")
	store3 := NewOSSStore().(*OSSStore)
	if !store3.UseHTTPS {
		t.Fatalf("UseHTTPS should be true when OSS_USE_HTTPS=1")
	}
}
