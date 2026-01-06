package main

import "github.com/code-100-precent/LingEcho/pkg/sip1"

func main() {
	server, err := sip1.NewSipServer(10000, 5060, nil)
	if err != nil {
		panic(err)
	}
	defer server.Close()
	server.Start()
	select {}
}
