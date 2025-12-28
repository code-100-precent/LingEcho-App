package stores

import (
	"io"
	"os"
	"path"
	"path/filepath"
	"strings"

	"github.com/code-100-precent/LingEcho/pkg/config"
	"github.com/code-100-precent/LingEcho/pkg/utils"
)

var UploadDir string = "./uploads"

// MediaPrefix defines the public URL prefix for locally stored files.
// Default to "/uploads" to align with other upload endpoints.
var MediaPrefix string = "/uploads"

type LocalStore struct {
	Root       string
	NewDirPerm os.FileMode
}

// Delete implements Store.
func (l *LocalStore) Delete(key string) error {
	// 确保Root是绝对路径
	root, err := filepath.Abs(l.Root)
	if err != nil {
		return err
	}

	fname := filepath.Clean(filepath.Join(root, key))
	if !strings.HasPrefix(fname, root) {
		return ErrInvalidPath
	}
	return os.Remove(fname)
}

// Exists implements Store.
func (l *LocalStore) Exists(key string) (bool, error) {
	// 确保Root是绝对路径
	root, err := filepath.Abs(l.Root)
	if err != nil {
		return false, err
	}

	fname := filepath.Clean(filepath.Join(root, key))
	if !strings.HasPrefix(fname, root) {
		return false, ErrInvalidPath
	}
	_, err = os.Stat(fname)
	if err != nil {
		if os.IsNotExist(err) {
			return false, nil
		}
		return false, err
	}
	return true, nil
}

// Read implements Store.
func (l *LocalStore) Read(key string) (io.ReadCloser, int64, error) {
	// 确保Root是绝对路径
	root, err := filepath.Abs(l.Root)
	if err != nil {
		return nil, 0, err
	}

	fname := filepath.Clean(filepath.Join(root, key))
	if !strings.HasPrefix(fname, root) {
		return nil, 0, ErrInvalidPath
	}
	st, err := os.Stat(fname)
	if err != nil {
		return nil, 0, err
	}
	f, err := os.Open(fname)
	if err != nil {
		return nil, 0, err
	}
	return f, st.Size(), nil
}

// Write implements Store.
func (l *LocalStore) Write(key string, r io.Reader) error {
	// 确保Root是绝对路径
	root, err := filepath.Abs(l.Root)
	if err != nil {
		return err
	}

	fname := filepath.Clean(filepath.Join(root, key))
	if !strings.HasPrefix(fname, root) {
		return ErrInvalidPath
	}
	dir := filepath.Dir(fname)
	err = os.MkdirAll(dir, l.NewDirPerm)
	if err != nil {
		return err
	}
	f, err := os.Create(fname)
	if err != nil {
		return err
	}
	defer f.Close()
	_, err = io.Copy(f, r)
	return err
}

func (l *LocalStore) PublicURL(key string) string {
	mediaPrefix := utils.GetEnv("MEDIA_PREFIX")
	if mediaPrefix == "" {
		mediaPrefix = MediaPrefix
	}
	// 使用 path.Join 而不是 filepath.Join，确保 URL 路径始终使用正斜杠
	// 同时规范化路径，移除多余斜杠
	mediaPrefix = strings.TrimSuffix(mediaPrefix, "/")
	key = strings.TrimPrefix(key, "/")
	relativePath := path.Join("/", mediaPrefix, key)

	// 如果配置了 SERVER_URL，返回完整 URL；否则返回相对路径
	if config.GlobalConfig != nil && config.GlobalConfig.ServerUrl != "" {
		baseURL := strings.TrimSuffix(config.GlobalConfig.ServerUrl, "/")
		return baseURL + relativePath
	}

	return relativePath
}

func NewLocalStore() Store {
	uploadDir := utils.GetEnv("UPLOAD_DIR")
	if uploadDir == "" {
		uploadDir = UploadDir
	}
	s := &LocalStore{
		Root:       uploadDir,
		NewDirPerm: 0755,
	}
	return s
}
