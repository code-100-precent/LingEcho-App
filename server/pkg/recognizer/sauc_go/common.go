package sauc_go

import (
	"bytes"
	"compress/gzip"
	"encoding/binary"
	"fmt"
	"io"
	"os"
	"os/exec"
	"strconv"
	"time"
)

const DefaultSampleRate = 16000

type ProtocolVersion byte
type MessageType byte
type MessageTypeSpecificFlags byte
type SerializationType byte
type CompressionType byte

const (
	PROTOCOL_VERSION = ProtocolVersion(0b0001)

	// Message Type
	CLIENT_FULL_REQUEST       = MessageType(0b0001)
	CLIENT_AUDIO_ONLY_REQUEST = MessageType(0b0010)
	SERVER_FULL_RESPONSE      = MessageType(0b1001)
	SERVER_ERROR_RESPONSE     = MessageType(0b1111)

	// Message Type Specific Flags
	NO_SEQUENCE       = MessageTypeSpecificFlags(0b0000) // no check sequence
	POS_SEQUENCE      = MessageTypeSpecificFlags(0b0001)
	NEG_SEQUENCE      = MessageTypeSpecificFlags(0b0010)
	NEG_WITH_SEQUENCE = MessageTypeSpecificFlags(0b0011)

	// Message Serialization
	NO_SERIALIZATION = SerializationType(0b0000)
	JSON             = SerializationType(0b0001)

	// Message Compression
	GZIP = CompressionType(0b0001)
)

func GzipCompress(input []byte) []byte {
	var b bytes.Buffer
	w := gzip.NewWriter(&b)
	_, _ = w.Write(input)
	_ = w.Close()

	return b.Bytes()
}

func GzipDecompress(input []byte) []byte {
	b := bytes.NewBuffer(input)
	r, _ := gzip.NewReader(b)
	out, _ := io.ReadAll(r)
	_ = r.Close()
	return out
}

// JudgeWav checks if the byte array is a valid WAV file
func JudgeWav(data []byte) bool {
	if len(data) < 44 {
		return false
	}
	if string(data[0:4]) == "RIFF" && string(data[8:12]) == "WAVE" {
		return true
	}
	return false
}

// ConvertWavWithPath converts an audio file to WAV format with the specified sample rate
func ConvertWavWithPath(audioPath string, sampleRate int) ([]byte, error) {
	cmd := exec.Command("ffmpeg", "-v", "quiet", "-y", "-i", audioPath, "-acodec",
		"pcm_s16le", "-ac", "1", "-ar", strconv.Itoa(sampleRate), "-f", "wav", "-")

	var out bytes.Buffer
	cmd.Stdout = &out

	err := cmd.Start()
	if err != nil {
		return nil, fmt.Errorf("command start error: %v", err)
	}

	done := make(chan error)
	go func() {
		done <- cmd.Wait()
	}()

	select {
	case <-time.After(60 * time.Second):
		if err := cmd.Process.Kill(); err != nil {
			fmt.Printf("failed to kill process: %v\n", err)
		}
		<-done
		return nil, fmt.Errorf("process killed as timeout reached")
	case err := <-done:
		if err != nil {
			return nil, fmt.Errorf("process run error: %v", err)
		}
	}

	if _, err := os.Stat(audioPath); err == nil {
		if removeErr := os.Remove(audioPath); removeErr != nil {
			fmt.Printf("failed to remove original file: %v\n", removeErr)
		}
	}

	return out.Bytes(), nil
}

type WavHeader struct {
	ChunkID       [4]byte
	ChunkSize     uint32
	Format        [4]byte
	Subchunk1ID   [4]byte
	Subchunk1Size uint32
	AudioFormat   uint16
	NumChannels   uint16
	SampleRate    uint32
	ByteRate      uint32
	BlockAlign    uint16
	BitsPerSample uint16
	Subchunk2ID   [4]byte
	Subchunk2Size uint32
}

// ReadWavInfo reads WAV file info and returns channels, sample width, sample rate, packet count, data, and error
func ReadWavInfo(data []byte) (int, int, int, int, []byte, error) {
	reader := bytes.NewReader(data)
	var header WavHeader

	if err := binary.Read(reader, binary.LittleEndian, &header); err != nil {
		return 0, 0, 0, 0, nil, fmt.Errorf("failed to read WAV header: %v", err)
	}

	nchannels := int(header.NumChannels)
	sampwidth := int(header.BitsPerSample / 8)
	framerate := int(header.SampleRate)
	nframes := int(header.Subchunk2Size) / (nchannels * sampwidth)

	waveBytes := make([]byte, header.Subchunk2Size)
	if _, err := io.ReadFull(reader, waveBytes); err != nil {
		return 0, 0, 0, 0, nil, fmt.Errorf("failed to read WAV data: %v", err)
	}

	return nchannels, sampwidth, framerate, nframes, waveBytes, nil
}
