package stores

import (
	"io"
	"net/http"

	"github.com/code-100-precent/LingEcho/pkg/utils"
)

const (
	KindLocal = "local"
	KindCos   = "cos"   // tencent
	KindMinio = "minio" // minio/s3 compatible
	KindQiNiu = "qiniu"
)

var ErrInvalidPath = &utils.Error{Code: http.StatusBadRequest, Message: "invalid path"}

// DefaultStoreKind 默认存储类型，从环境变量 STORAGE_KIND 读取，可选值：local, qiniu, cos, minio
// 如果未设置环境变量，默认使用 local
var DefaultStoreKind = getDefaultStoreKind()

// getDefaultStoreKind 从环境变量获取默认存储类型
func getDefaultStoreKind() string {
	kind := utils.GetEnv("STORAGE_KIND")
	if kind == "" {
		return KindLocal
	}
	// 验证存储类型是否有效
	switch kind {
	case KindLocal, KindCos, KindMinio, KindQiNiu:
		return kind
	default:
		// 无效的类型，使用默认值并记录警告
		return KindLocal
	}
}

// Store Common Storage Modules
type Store interface {
	Read(key string) (io.ReadCloser, int64, error)
	Write(key string, r io.Reader) error
	Delete(key string) error
	Exists(key string) (bool, error)
	PublicURL(key string) string
}

func GetStore(kind string) Store {
	switch kind {
	case KindCos:
		return NewCosStore()
	case KindMinio:
		return NewMinioStore()
	case KindQiNiu:
		return NewQiNiuStore()
	default:
		return NewLocalStore()
	}
}

func Default() Store {
	return GetStore(DefaultStoreKind)
}
