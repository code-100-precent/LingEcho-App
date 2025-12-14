package stores

//
//// ----------------- 最小 S3 兼容 fake server（含 multipart） -----------------
//
//type s3Err struct {
//	XMLName   xml.Name `xml:"Error"`
//	Code      string   `xml:"Code"`
//	Message   string   `xml:"Message"`
//	Resource  string   `xml:"Resource"`
//	RequestID string   `xml:"RequestId"`
//}
//
//// InitiateMultipartUploadResult
//type initMPUResult struct {
//	XMLName  xml.Name `xml:"InitiateMultipartUploadResult"`
//	Bucket   string   `xml:"Bucket"`
//	Key      string   `xml:"Key"`
//	UploadId string   `xml:"UploadId"`
//}
//
//// CompleteMultipartUploadResult
//type completeMPUResult struct {
//	XMLName  xml.Name `xml:"CompleteMultipartUploadResult"`
//	Location string   `xml:"Location"`
//	Bucket   string   `xml:"Bucket"`
//	Key      string   `xml:"Key"`
//	ETag     string   `xml:"ETag"`
//}
//
//type fakeS3 struct {
//	bucket       string
//	bucketExists bool
//	objects      map[string][]byte
//	uploads      map[string]*mpu // uploadId → parts
//}
//
//type mpu struct {
//	key   string
//	parts map[int][]byte // partNumber -> data
//}
//
//func newFakeS3(bucket string) *fakeS3 {
//	return &fakeS3{
//		bucket:  bucket,
//		objects: make(map[string][]byte),
//		uploads: make(map[string]*mpu),
//	}
//}
//
//func (s *fakeS3) handler(w http.ResponseWriter, r *http.Request) {
//	// 路径： /<bucket>[/<key>]
//	clean := path.Clean(r.URL.Path)
//	parts := strings.Split(strings.TrimPrefix(clean, "/"), "/")
//	if len(parts) == 0 || parts[0] == "" {
//		http.NotFound(w, r)
//		return
//	}
//	bucket := parts[0]
//	var key string
//	if len(parts) > 1 {
//		key = strings.Join(parts[1:], "/")
//	}
//	if bucket != s.bucket {
//		http.NotFound(w, r)
//		return
//	}
//
//	q := r.URL.Query()
//	switch r.Method {
//	case http.MethodHead:
//		if key == "" {
//			// HeadBucket
//			if s.bucketExists {
//				w.WriteHeader(http.StatusOK)
//				return
//			}
//			http.Error(w, "no such bucket", http.StatusNotFound)
//			return
//		}
//		// StatObject
//		if data, ok := s.objects[key]; ok {
//			w.Header().Set("Content-Length", itoa(len(data)))
//			w.Header().Set("Last-Modified", time.Now().UTC().Format(http.TimeFormat))
//			w.WriteHeader(http.StatusOK)
//			return
//		}
//		// 返回带有 S3 错误体（minio-go 会解析）
//		w.WriteHeader(http.StatusNotFound)
//		_ = xml.NewEncoder(w).Encode(s3Err{
//			Code:      "NoSuchKey",
//			Message:   "key not found",
//			Resource:  "/" + bucket + "/" + key,
//			RequestID: "req-head",
//		})
//		return
//
//	case http.MethodPut:
//		// 可能是 PutObject 或 Upload Part（有 ?partNumber=&uploadId=）
//		uploadID := q.Get("uploadId")
//		partNum := q.Get("partNumber")
//		if uploadID != "" && partNum != "" {
//			// Upload Part
//			mpu := s.uploads[uploadID]
//			if mpu == nil || mpu.key != key {
//				w.WriteHeader(http.StatusNotFound)
//				_ = xml.NewEncoder(w).Encode(s3Err{Code: "NoSuchUpload", Message: "no such upload"})
//				return
//			}
//			body, _ := io.ReadAll(r.Body)
//			_ = r.Body.Close()
//			pn := atoi(partNum)
//			if mpu.parts == nil {
//				mpu.parts = make(map[int][]byte)
//			}
//			mpu.parts[pn] = body
//			w.Header().Set("ETag", `"part-etag"`)
//			w.WriteHeader(http.StatusOK)
//			return
//		}
//
//		if key == "" {
//			// MakeBucket
//			s.bucketExists = true
//			w.WriteHeader(http.StatusOK)
//			return
//		}
//
//		// 单次 PUT 对象（minio 在 size 已知或很小也可能用这个路径）
//		if !s.bucketExists {
//			http.Error(w, "no such bucket", http.StatusNotFound)
//			return
//		}
//		body, _ := io.ReadAll(r.Body)
//		_ = r.Body.Close()
//		s.objects[key] = body
//		w.Header().Set("ETag", `"fake-etag"`)
//		w.WriteHeader(http.StatusOK)
//		return
//
//	case http.MethodPost:
//		// 发起 MPU: ?uploads
//		if q.Has("uploads") {
//			if !s.bucketExists {
//				http.Error(w, "no such bucket", http.StatusNotFound)
//				return
//			}
//			uploadID := "u1-" + strings.ReplaceAll(key, "/", "_")
//			s.uploads[uploadID] = &mpu{key: key, parts: make(map[int][]byte)}
//			w.Header().Set("Content-Type", "application/xml")
//			_ = xml.NewEncoder(w).Encode(initMPUResult{
//				Bucket:   bucket,
//				Key:      key,
//				UploadId: uploadID,
//			})
//			return
//		}
//		// 完成 MPU: ?uploadId=
//		if uploadID := q.Get("uploadId"); uploadID != "" {
//			mpu := s.uploads[uploadID]
//			if mpu == nil || mpu.key != key {
//				w.WriteHeader(http.StatusNotFound)
//				_ = xml.NewEncoder(w).Encode(s3Err{Code: "NoSuchUpload", Message: "no such upload"})
//				return
//			}
//			// 将 parts 按 partNumber 拼接（简单起见，按 1..N）
//			var buf bytes.Buffer
//			for i := 1; ; i++ {
//				part, ok := mpu.parts[i]
//				if !ok {
//					break
//				}
//				buf.Write(part)
//			}
//			s.objects[key] = buf.Bytes()
//			delete(s.uploads, uploadID)
//			w.Header().Set("Content-Type", "application/xml")
//			_ = xml.NewEncoder(w).Encode(completeMPUResult{
//				Location: "/" + bucket + "/" + key,
//				Bucket:   bucket,
//				Key:      key,
//				ETag:     `"complete-etag"`,
//			})
//			return
//		}
//		http.Error(w, "bad post", http.StatusBadRequest)
//		return
//
//	case http.MethodGet:
//		// GetObject
//		data, ok := s.objects[key]
//		if !ok {
//			w.WriteHeader(http.StatusNotFound)
//			_ = xml.NewEncoder(w).Encode(s3Err{
//				Code:      "NoSuchKey",
//				Message:   "key not found",
//				Resource:  "/" + bucket + "/" + key,
//				RequestID: "req-get",
//			})
//			return
//		}
//		w.Header().Set("Content-Length", itoa(len(data)))
//		_, _ = w.Write(data)
//		return
//
//	case http.MethodDelete:
//		// RemoveObject
//		delete(s.objects, key)
//		w.WriteHeader(http.StatusNoContent)
//		return
//	}
//
//	http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
//}
//
//func itoa(n int) string {
//	if n == 0 {
//		return "0"
//	}
//	neg := false
//	if n < 0 {
//		neg = true
//		n = -n
//	}
//	var b [32]byte
//	i := len(b)
//	for n > 0 {
//		i--
//		b[i] = byte('0' + n%10)
//		n /= 10
//	}
//	if neg {
//		i--
//		b[i] = '-'
//	}
//	return string(b[i:])
//}
//
//func atoi(s string) int {
//	n := 0
//	for i := 0; i < len(s); i++ {
//		c := s[i]
//		if c < '0' || c > '9' {
//			break
//		}
//		n = n*10 + int(c-'0')
//	}
//	return n
//}
//
//// ----------------- 辅助：minio 客户端 endpoint -----------------
//
//func hostPortFromURL(u string) string {
//	pu, _ := url.Parse(u)
//	return pu.Host // minio.New 需要 host:port
//}
//
//// ----------------- Tests -----------------
//
//func TestMinioStore_FullCycle(t *testing.T) {
//	const bucket = "test-bucket"
//
//	// fake S3 server
//	s3 := newFakeS3(bucket)
//	ts := httptest.NewServer(http.HandlerFunc(s3.handler))
//	defer ts.Close()
//
//	// store 指向 fake S3
//	ms := &MinioStore{
//		Endpoint:  hostPortFromURL(ts.URL), // 不带协议
//		AccessKey: "",
//		SecretKey: "",
//		Bucket:    bucket,
//		UseSSL:    false,
//		BaseURL:   "",
//	}
//	if ms.AccessKey == "" {
//		t.Skip("no minio credentials")
//	}
//
//	// Write（应自动建桶 & 支持 multipart）
//	payload := []byte("hello-minio")
//	if err := ms.Write("dir/obj.txt", bytes.NewReader(payload)); err != nil {
//		t.Fatalf("Write error: %v", err)
//	}
//
//	// Exists -> true
//	ok, err := ms.Exists("dir/obj.txt")
//	if err != nil {
//		t.Fatalf("Exists(true) error: %v", err)
//	}
//	if !ok {
//		t.Fatalf("Exists returned false for existing key")
//	}
//
//	// Read
//	rc, size, err := ms.Read("dir/obj.txt")
//	if err != nil {
//		t.Fatalf("Read error: %v", err)
//	}
//	defer rc.Close()
//	if size != int64(len(payload)) {
//		t.Fatalf("size = %d, want %d", size, len(payload))
//	}
//	got, _ := io.ReadAll(rc)
//	if !bytes.Equal(got, payload) {
//		t.Fatalf("Read content mismatch: %q != %q", string(got), string(payload))
//	}
//
//	// Exists -> false（缺失键）
//	ok, err = ms.Exists("missing.txt")
//	if err != nil && ok {
//		t.Fatalf("Exists(missing) unexpected ok with err: %v", err)
//	}
//	if ok {
//		t.Fatalf("Exists returned true for missing key")
//	}
//
//	// Delete
//	if err := ms.Delete("dir/obj.txt"); err != nil {
//		t.Fatalf("Delete error: %v", err)
//	}
//	ok, _ = ms.Exists("dir/obj.txt")
//	if ok {
//		t.Fatalf("object still exists after delete")
//	}
//}
//
//func TestMinioStore_PublicURL(t *testing.T) {
//	ms := &MinioStore{
//		Endpoint: "127.0.0.1:9000",
//		Bucket:   "bkt",
//		UseSSL:   false,
//	}
//	u := ms.PublicURL("a/b/c.txt")
//	if u != "http://127.0.0.1:9000/bkt/a/b/c.txt" {
//		t.Fatalf("PublicURL http got %q", u)
//	}
//
//	ms.UseSSL = true
//	u = ms.PublicURL("k.txt")
//	if u != "https://127.0.0.1:9000/bkt/k.txt" {
//		t.Fatalf("PublicURL https got %q", u)
//	}
//
//	ms.BaseURL = "https://cdn.example.com/base/"
//	u = ms.PublicURL("x/y")
//	if u != "https://cdn.example.com/base/x/y" {
//		t.Fatalf("PublicURL base override got %q", u)
//	}
//}
//
//func TestNewMinioStore_EnvParsing(t *testing.T) {
//	restore := captureEnv(map[string]string{
//		"MINIO_ENDPOINT":    "",
//		"MINIO_ACCESS_KEY":  "",
//		"MINIO_SECRET_KEY":  "",
//		"MINIO_BUCKET":      "",
//		"MINIO_USE_SSL":     "",
//		"MINIO_PUBLIC_BASE": "",
//	})
//	defer restore()
//
//	_ = os.Setenv("MINIO_ENDPOINT", "minio.local:9000")
//	_ = os.Setenv("MINIO_ACCESS_KEY", "ak")
//	_ = os.Setenv("MINIO_SECRET_KEY", "sk")
//	_ = os.Setenv("MINIO_BUCKET", "bkt")
//	_ = os.Setenv("MINIO_PUBLIC_BASE", "https://pub.example.com")
//
//	// "1" -> true
//	_ = os.Setenv("MINIO_USE_SSL", "1")
//	s := NewMinioStore().(*MinioStore)
//	if !s.UseSSL {
//		t.Fatalf("UseSSL should be true when MINIO_USE_SSL=1")
//	}
//	if s.Endpoint != "minio.local:9000" || s.AccessKey != "ak" || s.SecretKey != "sk" || s.Bucket != "bkt" || s.BaseURL != "https://pub.example.com" {
//		t.Fatalf("env parsing mismatch: %+v", *s)
//	}
//
//	// "true" (大小写不敏感)
//	_ = os.Setenv("MINIO_USE_SSL", "TrUe")
//	s2 := NewMinioStore().(*MinioStore)
//	if !s2.UseSSL {
//		t.Fatalf("UseSSL should be true when MINIO_USE_SSL=true")
//	}
//
//	// 空 -> false
//	_ = os.Setenv("MINIO_USE_SSL", "")
//	s3 := NewMinioStore().(*MinioStore)
//	if s3.UseSSL {
//		t.Fatalf("UseSSL should be false when MINIO_USE_SSL empty")
//	}
//}
//
//// 额外：验证 client() 报错时的早退
//func TestMinioStore_ClientErrorPropagation(t *testing.T) {
//	ms := &MinioStore{
//		Endpoint:  "bad host:port", // 非法 endpoint
//		AccessKey: "ak",
//		SecretKey: "sk",
//		Bucket:    "bkt",
//		UseSSL:    false,
//	}
//	if _, _, err := ms.Read("k"); err == nil {
//		t.Fatalf("Read expected error with bad endpoint")
//	}
//	if err := ms.Write("k", bytes.NewReader([]byte("x"))); err == nil {
//		t.Fatalf("Write expected error with bad endpoint")
//	}
//	if err := ms.Delete("k"); err == nil {
//		t.Fatalf("Delete expected error with bad endpoint")
//	}
//	if _, err := ms.Exists("k"); err == nil {
//		t.Fatalf("Exists expected error with bad endpoint")
//	}
//}
//
//// ----------------- helpers -----------------
//
//func captureEnv(keys map[string]string) func() {
//	orig := make(map[string]string, len(keys))
//	for k := range keys {
//		orig[k] = os.Getenv(k)
//	}
//	return func() {
//		for k, v := range orig {
//			_ = os.Setenv(k, v)
//		}
//	}
//}
