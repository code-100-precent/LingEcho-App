package stores

import (
	"context"
	"fmt"
	"io"
	"log"
	"net/http"
	"net/url"
	"os"

	"github.com/code-100-precent/LingEcho/pkg/utils"
	"github.com/tencentyun/cos-go-sdk-v5"
)

type CosStore struct {
	SecretID   string `env:"SECRET_ID"`
	SecretKey  string `env:"SECRET_KEY"`
	Region     string `env:"REGION"`
	BucketName string `env:"BUCKET_NAME"`
}

// Delete implements Store.
func (c *CosStore) Delete(key string) error {
	cClient := InitCos(c)
	name := key
	_, err := cClient.Object.Delete(context.Background(), name)
	if err != nil {
		panic(err)
	}
	return err
}

// Exists implements Store.
func (c *CosStore) Exists(key string) (bool, error) {
	cClient := InitCos(c)
	ok, err := cClient.Object.IsExist(context.Background(), key)
	if err == nil && ok {
		fmt.Printf("object exists\n")
	} else if err != nil {
		fmt.Printf("head object failed: %v\n", err)
	} else {
		fmt.Printf("object does not exist\n")
	}
	return ok, err
}

// Read implements Store.
func (c *CosStore) Read(key string) (io.ReadCloser, int64, error) {
	cClient := InitCos(c)
	ourl := cClient.Object.GetObjectURL(key)
	file, _ := os.Open(ourl.String())
	opt := &cos.BucketGetOptions{
		Prefix:  key,
		MaxKeys: 1,
	}
	v, _, err := cClient.Bucket.Get(context.Background(), opt)
	if err != nil {
		panic(err)
	}

	p := v.Contents[0]
	log.Println("文件列表：：", p.Key)
	return file, p.Size, err
}

// Write implements Store.
func (c *CosStore) Write(key string, r io.Reader) error {
	cClient := InitCos(c)
	name := key
	_, err := cClient.Object.Put(context.Background(), name, r, nil)
	if err != nil {
		panic(err)
	}

	return err
}

func (o *CosStore) PublicURL(key string) string {
	panic("unimplemented")
}
func NewCosStore() Store {
	return &CosStore{
		SecretID:   utils.GetEnv("SECRET_ID"),
		SecretKey:  utils.GetEnv("SECRET_KEY"),
		Region:     utils.GetEnv("REGION"),
		BucketName: utils.GetEnv("BUCKET_NAME"),
	}
}

func InitCos(c *CosStore) *cos.Client {
	u, _ := url.Parse("https://" + c.BucketName + ".cos." + c.Region + ".myqcloud.com")
	b := &cos.BaseURL{BucketURL: u}
	cClient := cos.NewClient(b, &http.Client{
		Transport: &cos.AuthorizationTransport{
			SecretID:  c.SecretID,
			SecretKey: c.SecretKey,
		},
	})
	return cClient
}
