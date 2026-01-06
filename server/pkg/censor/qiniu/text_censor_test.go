package qiniu

import (
	"encoding/json"
	"strings"
	"testing"
)

func TestTextCensorRequest_Marshal(t *testing.T) {
	req := TextCensorRequest{
		Data: TextCensorData{
			Text: "Qiniu text moderation example",
		},
		Params: TextCensorParams{
			Scenes: []string{"antispam"},
		},
	}

	jsonData, err := json.Marshal(req)
	if err != nil {
		t.Fatalf("Failed to serialize: %v", err)
	}

	// Verify JSON contains necessary fields
	jsonStr := string(jsonData)
	if !strings.Contains(jsonStr, "Qiniu text moderation example") {
		t.Error("Text was not serialized correctly")
	}
	if !strings.Contains(jsonStr, "antispam") {
		t.Error("Scenes was not serialized correctly")
	}
}

func TestNewTextCensorClient(t *testing.T) {
	client := NewTextCensorClient("test_access_key", "test_secret_key")
	if client.AccessKey != "test_access_key" {
		t.Error("AccessKey was set incorrectly")
	}
	if client.SecretKey != "test_secret_key" {
		t.Error("SecretKey was set incorrectly")
	}
	if client.Host != TextCensorHost {
		t.Errorf("Host was set incorrectly: expected %s, got %s", TextCensorHost, client.Host)
	}
	if client.Client == nil {
		t.Error("HTTP Client was not initialized")
	}
}
