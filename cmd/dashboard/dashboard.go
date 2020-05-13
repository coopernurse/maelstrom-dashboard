package main

import (
	"bytes"
	"fmt"
	"io"
	"log"
	"net/http"
	"os"
	"strings"
)

func main() {
	http.HandleFunc("/rpc/nodestatus", NodeStatusHandler)
	http.Handle("/", http.FileServer(http.Dir("./static")))
	log.Fatal(http.ListenAndServe(":8080", nil))
}

func NodeStatusHandler(w http.ResponseWriter, r *http.Request) {
	data := `{"jsonrpc":"2.0", "id": "12345", "method": "NodeService.ListNodeStatus", "params": [{"forceRefresh":true}]}`
	endpoint := os.Getenv("DASHBOARD_MAEL_URL")
	if endpoint == "" {
		endpoint = os.Getenv("MAELSTROM_PRIVATE_URL")
	}
	if endpoint == "" {
		w.WriteHeader(500)
		fmt.Fprintf(w, "ERROR: DASHBOARD_MAEL_URL and MAELSTROM_PRIVATE_URL env vars are both empty")
	} else {
		buf := bytes.NewBufferString(data)
		endpoint += "/_mael/v1"
		resp, err := http.Post(endpoint, "application/json", buf)
		if err == nil {
			defer resp.Body.Close()
			w.Header().Set("content-type", resp.Header.Get("content-type"))
			w.WriteHeader(resp.StatusCode)
			_, err = io.Copy(w, resp.Body)
			if err != nil {
				level := "ERROR"
				if strings.Contains(err.Error(), "broken pipe") {
					level = "WARN"
				}
				log.Printf("%s NodeStatusHandler io.Copy: %v", level, err)
			}
		} else {
			w.WriteHeader(500)
			fmt.Fprintf(w, "Error requesting node status")
			log.Printf("ERROR NodeStatusHandler endpoint=%s err=%v", endpoint, err)
		}
	}
}
