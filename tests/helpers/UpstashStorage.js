import { Redis } from '@upstash/redis';

/**
 * Upstash Redis Adapter
 * Connects the SDK logic to a Redis database via HTTP.
 */
export default class UpstashStorage {

    constructor(url, token, prefix = 'aw_') {
        this.client = new Redis({
            url: url,
            token: token,
        });
        this.prefix = prefix;
    }

    async get(key) {
        return await this.client.get(this.prefix + key);
    }

    async set(key, value) {
        let ttl = 86400; // Default 24h
        if (value && value.expires_in) {
            ttl = value.expires_in;
        }
        await this.client.set(this.prefix + key, value, { ex: ttl });
    }

    async remove(key) {
        await this.client.del(this.prefix + key);
    }
}