package redis_test

import (
	"fmt"
	"time"

	. "github.com/onsi/ginkgo"
	. "github.com/onsi/gomega"

	"gopkg.in/redis.v3"
)

var _ = Describe("Redis ring", func() {
	var ring *redis.Ring

	setRingKeys := func() {
		for i := 0; i < 100; i++ {
			err := ring.Set(fmt.Sprintf("key%d", i), "value", 0).Err()
			Expect(err).NotTo(HaveOccurred())
		}
	}

	BeforeEach(func() {
		ring = redis.NewRing(&redis.RingOptions{
			Addrs: map[string]string{
				"ringShard1": ":" + ringShard1Port,
				"ringShard2": ":" + ringShard2Port,
			},
		})

		// Shards should not have any keys.
		Expect(ringShard1.FlushDb().Err()).NotTo(HaveOccurred())
		Expect(ringShard1.Info().Val()).NotTo(ContainSubstring("keys="))

		Expect(ringShard2.FlushDb().Err()).NotTo(HaveOccurred())
		Expect(ringShard2.Info().Val()).NotTo(ContainSubstring("keys="))
	})

	AfterEach(func() {
		Expect(ring.Close()).NotTo(HaveOccurred())
	})

	It("uses both shards", func() {
		setRingKeys()

		// Both shards should have some keys now.
		Expect(ringShard1.Info().Val()).To(ContainSubstring("keys=57"))
		Expect(ringShard2.Info().Val()).To(ContainSubstring("keys=43"))
	})

	It("uses one shard when other shard is down", func() {
		// Stop ringShard2.
		Expect(ringShard2.Close()).NotTo(HaveOccurred())

		// Ring needs 5 * heartbeat time to detect that node is down.
		// Give it more to be sure.
		heartbeat := 100 * time.Millisecond
		time.Sleep(5*heartbeat + heartbeat)

		setRingKeys()

		// RingShard1 should have all keys.
		Expect(ringShard1.Info().Val()).To(ContainSubstring("keys=100"))

		// Start ringShard2.
		var err error
		ringShard2, err = startRedis(ringShard2Port)
		Expect(err).NotTo(HaveOccurred())

		// Wait for ringShard2 to come up.
		Eventually(func() error {
			return ringShard2.Ping().Err()
		}, "1s").ShouldNot(HaveOccurred())

		// Ring needs heartbeat time to detect that node is up.
		// Give it more to be sure.
		time.Sleep(heartbeat + heartbeat)

		setRingKeys()

		// RingShard2 should have its keys.
		Expect(ringShard2.Info().Val()).To(ContainSubstring("keys=43"))
	})

	It("supports pipelining", func() {
		pipe := ring.Pipeline()
		for i := 0; i < 100; i++ {
			err := pipe.Set(fmt.Sprintf("key%d", i), "value", 0).Err()
			Expect(err).NotTo(HaveOccurred())
		}
		cmds, err := pipe.Exec()
		Expect(err).NotTo(HaveOccurred())
		Expect(cmds).To(HaveLen(100))
		Expect(pipe.Close()).NotTo(HaveOccurred())

		for _, cmd := range cmds {
			Expect(cmd.Err()).NotTo(HaveOccurred())
			Expect(cmd.(*redis.StatusCmd).Val()).To(Equal("OK"))
		}

		// Both shards should have some keys now.
		Expect(ringShard1.Info().Val()).To(ContainSubstring("keys=57"))
		Expect(ringShard2.Info().Val()).To(ContainSubstring("keys=43"))
	})
})
