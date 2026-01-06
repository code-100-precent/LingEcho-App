package stores

import (
	"fmt"
	"io"
	"strings"

	"github.com/aliyun/aliyun-oss-go-sdk/oss"
	"github.com/code-100-precent/LingEcho/pkg/utils"
)

// OSSStore represents Alibaba Cloud OSS storage
type OSSStore struct {
	Endpoint        string `env:"OSS_ENDPOINT"`
	AccessKeyID     string `env:"OSS_ACCESS_KEY_ID"`
	AccessKeySecret string `env:"OSS_ACCESS_KEY_SECRET"`
	BucketName      string `env:"OSS_BUCKET"`
	Domain          string `env:"OSS_DOMAIN"` // Custom domain for public access
	UseHTTPS        bool   `env:"OSS_USE_HTTPS"`
}

// NewOSSStore creates a new OSS storage instance
func NewOSSStore() Store {
	useHTTPS := strings.ToLower(utils.GetEnv("OSS_USE_HTTPS")) == "true" || utils.GetEnv("OSS_USE_HTTPS") == "1"
	return &OSSStore{
		Endpoint:        utils.GetEnv("OSS_ENDPOINT"),
		AccessKeyID:     utils.GetEnv("OSS_ACCESS_KEY_ID"),
		AccessKeySecret: utils.GetEnv("OSS_ACCESS_KEY_SECRET"),
		BucketName:      utils.GetEnv("OSS_BUCKET"),
		Domain:          utils.GetEnv("OSS_DOMAIN"),
		UseHTTPS:        useHTTPS,
	}
}

// client creates and returns an OSS client
func (o *OSSStore) client() (*oss.Client, error) {
	client, err := oss.New(o.Endpoint, o.AccessKeyID, o.AccessKeySecret)
	if err != nil {
		return nil, fmt.Errorf("failed to create OSS client: %w", err)
	}
	return client, nil
}

// bucket returns the OSS bucket instance
func (o *OSSStore) bucket() (*oss.Bucket, error) {
	client, err := o.client()
	if err != nil {
		return nil, err
	}
	bucket, err := client.Bucket(o.BucketName)
	if err != nil {
		return nil, fmt.Errorf("failed to get bucket: %w", err)
	}
	return bucket, nil
}

// Read reads a file from OSS
func (o *OSSStore) Read(key string) (io.ReadCloser, int64, error) {
	bucket, err := o.bucket()
	if err != nil {
		return nil, 0, err
	}

	// Get object properties to get size
	props, err := bucket.GetObjectMeta(key)
	if err != nil {
		return nil, 0, fmt.Errorf("failed to get object meta: %w", err)
	}

	var size int64
	if contentLength := props.Get("Content-Length"); contentLength != "" {
		fmt.Sscanf(contentLength, "%d", &size)
	}

	// Get object
	body, err := bucket.GetObject(key)
	if err != nil {
		return nil, 0, fmt.Errorf("failed to get object: %w", err)
	}

	return body, size, nil
}

// Write writes a file to OSS
func (o *OSSStore) Write(key string, r io.Reader) error {
	bucket, err := o.bucket()
	if err != nil {
		return err
	}

	err = bucket.PutObject(key, r)
	if err != nil {
		return fmt.Errorf("failed to put object: %w", err)
	}

	return nil
}

// Delete deletes a file from OSS
func (o *OSSStore) Delete(key string) error {
	bucket, err := o.bucket()
	if err != nil {
		return err
	}

	err = bucket.DeleteObject(key)
	if err != nil {
		return fmt.Errorf("failed to delete object: %w", err)
	}

	return nil
}

// Exists checks if a file exists in OSS
func (o *OSSStore) Exists(key string) (bool, error) {
	bucket, err := o.bucket()
	if err != nil {
		return false, err
	}

	exists, err := bucket.IsObjectExist(key)
	if err != nil {
		return false, fmt.Errorf("failed to check object existence: %w", err)
	}

	return exists, nil
}

// PublicURL returns the public URL for a file
func (o *OSSStore) PublicURL(key string) string {
	// If custom domain is set, use it
	if o.Domain != "" {
		domain := strings.TrimSuffix(o.Domain, "/")
		scheme := "http://"
		if o.UseHTTPS || strings.HasPrefix(domain, "https://") {
			scheme = "https://"
		}
		if !strings.HasPrefix(domain, "http://") && !strings.HasPrefix(domain, "https://") {
			domain = scheme + domain
		}
		return fmt.Sprintf("%s/%s", domain, strings.TrimPrefix(key, "/"))
	}

	// Otherwise, use OSS endpoint
	scheme := "http://"
	if o.UseHTTPS {
		scheme = "https://"
	}
	return fmt.Sprintf("%s%s.%s/%s", scheme, o.BucketName, o.Endpoint, strings.TrimPrefix(key, "/"))
}
