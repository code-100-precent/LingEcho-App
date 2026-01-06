package qiniu

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"

	"github.com/code-100-precent/LingEcho/pkg/censor/qiniu/auth"
)

const (
	// TextCensorEndpoint is the text moderation API endpoint
	TextCensorEndpoint = "/v3/text/censor"
	// TextCensorHost is the text moderation API host
	TextCensorHost = "ai.qiniuapi.com"
)

// TextCensorRequest represents the request parameters for text moderation
type TextCensorRequest struct {
	Data   TextCensorData   `json:"data"`
	Params TextCensorParams `json:"params"`
}

// TextCensorData represents the text data to be moderated
type TextCensorData struct {
	Text string `json:"text"` // Text content
}

// TextCensorParams represents moderation parameters
type TextCensorParams struct {
	Scenes []string `json:"scenes"` // Moderation type, required field, options: antispam
}

// TextCensorResponse represents the text moderation response
type TextCensorResponse struct {
	Code    int               `json:"code"`    // Processing status: 200 means success
	Message string            `json:"message"` // Status description corresponding to code
	Result  *TextCensorResult `json:"result"`  // Moderation result
}

// TextCensorResult represents the text moderation result
type TextCensorResult struct {
	Suggestion string                     `json:"suggestion"` // pass (approved), review (needs manual review), block (violation)
	Scenes     map[string]TextSceneResult `json:"scenes"`     // Moderation results for each scene
}

// TextSceneResult represents the moderation result for a scene
type TextSceneResult struct {
	Suggestion string            `json:"suggestion"` // Overall suggestion for this scene: pass/review/block
	Details    []TextSceneDetail `json:"details"`    // Detailed information array
}

// TextSceneDetail represents detailed moderation information for a scene
type TextSceneDetail struct {
	Label       string  `json:"label"`       // Moderation label: normal, spam, ad, politics, terrorism, abuse, porn, flood, contraband, meaningless
	Score       float64 `json:"score"`       // Confidence score
	Description string  `json:"description"` // Description of violation content
}

// TextCensorClient is the client for text content moderation
type TextCensorClient struct {
	AccessKey string
	SecretKey string
	Host      string
	Client    *http.Client
}

// NewTextCensorClient creates a new text moderation client
func NewTextCensorClient(accessKey, secretKey string) *TextCensorClient {
	return &TextCensorClient{
		AccessKey: accessKey,
		SecretKey: secretKey,
		Host:      TextCensorHost,
		Client:    &http.Client{},
	}
}

// Censor performs text content moderation
func (c *TextCensorClient) Censor(req TextCensorRequest) (*TextCensorResponse, error) {
	// Serialize request body
	bodyJSON, err := json.Marshal(req)
	if err != nil {
		return nil, fmt.Errorf("failed to serialize request parameters: %w", err)
	}

	// Generate authentication token
	authReq := auth.QiniuAuthRequest{
		Method:      "POST",
		Path:        TextCensorEndpoint,
		Host:        c.Host,
		ContentType: "application/json",
		Body:        bodyJSON,
	}

	token, err := auth.GenerateQiniuToken(c.AccessKey, c.SecretKey, authReq)
	if err != nil {
		return nil, fmt.Errorf("failed to generate authentication token: %w", err)
	}

	// Build HTTP request
	url := fmt.Sprintf("https://%s%s", c.Host, TextCensorEndpoint)
	httpReq, err := http.NewRequest("POST", url, bytes.NewReader(bodyJSON))
	if err != nil {
		return nil, fmt.Errorf("failed to create HTTP request: %w", err)
	}

	// Set request headers
	httpReq.Header.Set("Content-Type", "application/json")
	httpReq.Header.Set("Authorization", token)

	// Send request
	resp, err := c.Client.Do(httpReq)
	if err != nil {
		return nil, fmt.Errorf("failed to send HTTP request: %w", err)
	}
	defer resp.Body.Close()

	// Read response
	respBody, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("failed to read response: %w", err)
	}

	// Parse response
	var censorResp TextCensorResponse
	if err := json.Unmarshal(respBody, &censorResp); err != nil {
		return nil, fmt.Errorf("failed to parse response: %w, response content: %s", err, string(respBody))
	}

	// Check HTTP status code
	if resp.StatusCode != http.StatusOK {
		return &censorResp, fmt.Errorf("HTTP status code error: %d, response: %s", resp.StatusCode, string(respBody))
	}

	return &censorResp, nil
}

// CensorText is a convenience method to moderate text content
// text: text content to be moderated
func (c *TextCensorClient) CensorText(text string) (*TextCensorResponse, error) {
	req := TextCensorRequest{
		Data: TextCensorData{
			Text: text,
		},
		Params: TextCensorParams{
			Scenes: []string{"antispam"},
		},
	}
	return c.Censor(req)
}
