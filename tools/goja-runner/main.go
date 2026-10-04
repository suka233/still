// Command goja-runner executes JavaScript files in the same goja runtime setup
// SiYuan uses for kernel plugins (kernel/plugin/plugin.go, sandbox.go), so
// bundles can be checked for goja compatibility without a running SiYuan.
//
// Usage: goja-runner [-timeout 30s] file1.js [file2.js ...]
//
// Files run in order in one runtime. A script ends the run by calling
// __finish(code); uncaught errors and timeouts exit non-zero.
package main

import (
	"flag"
	"fmt"
	"os"
	"time"

	"github.com/dop251/goja"
	"github.com/dop251/goja_nodejs/buffer"
	"github.com/dop251/goja_nodejs/console"
	"github.com/dop251/goja_nodejs/eventloop"
	"github.com/dop251/goja_nodejs/require"
	"github.com/dop251/goja_nodejs/url"
)

func main() {
	timeout := flag.Duration("timeout", 30*time.Second, "maximum run time")
	flag.Parse()
	if flag.NArg() == 0 {
		fmt.Fprintln(os.Stderr, "usage: goja-runner [-timeout 30s] file.js...")
		os.Exit(2)
	}

	done := make(chan int, 1)
	finish := func(code int) {
		select {
		case done <- code:
		default:
		}
	}

	loop := eventloop.NewEventLoop(eventloop.EnableConsole(true))
	loop.Start()
	defer loop.Stop()

	loop.RunOnLoop(func(rt *goja.Runtime) {
		rt.SetFieldNameMapper(goja.TagFieldNameMapper("json", true))
		registry := require.NewRegistry()
		registry.Enable(rt)
		url.Enable(rt)
		buffer.Enable(rt)
		console.Enable(rt)

		_ = rt.Set("__finish", func(code int) { finish(code) })
		_ = rt.Set("__now", func() int64 { return time.Now().UnixMilli() })

		for _, file := range flag.Args() {
			src, err := os.ReadFile(file)
			if err != nil {
				fmt.Fprintf(os.Stderr, "read %s: %v\n", file, err)
				finish(2)
				return
			}
			if _, err := rt.RunScript(file, string(src)); err != nil {
				fmt.Fprintf(os.Stderr, "run %s: %v\n", file, err)
				finish(1)
				return
			}
		}
	})

	select {
	case code := <-done:
		os.Exit(code)
	case <-time.After(*timeout):
		fmt.Fprintln(os.Stderr, "timeout: script never called __finish()")
		os.Exit(1)
	}
}
