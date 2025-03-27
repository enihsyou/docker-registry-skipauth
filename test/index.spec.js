import { SELF } from 'cloudflare:test';
import { describe, it, expect } from 'vitest';
import * as sut from '../src/index.js';

describe('Integrate Test', () => {
    it('/v2/', async () => {
        const response = await SELF.fetch('https://example.com/v2/?upstream=registry-1.docker.io');
        expect(response.status).toBe(200);
    });
    it('/v2/library/alpine/manifests/latest', async () => {
        const response = await SELF.fetch('https://example.com/v2/library/alpine/manifests/latest?upstream=registry-1.docker.io');
        expect(response.status).toBe(200);
    });
    it('/v2/library/alpine/blobs/sha256:f18232174bc91741fdf3da96d85011092101a032a93a388b79e99e69c2d5c870', async () => {
        const response = await SELF.fetch('https://example.com/v2/library/alpine/blobs/sha256:f18232174bc91741fdf3da96d85011092101a032a93a388b79e99e69c2d5c870?upstream=registry-1.docker.io', {
            redirect: 'manual'
        });
        expect(response.status).toBe(307);
    });
});

describe('Unit Test', () => {
    it('parseAuthHeader', () => {
        const headerValue = 'Bearer realm="example",service="example:service"';
        const expected = {
            realm: 'example',
            service: 'example:service'
        };
        const result = sut.parseAuthHeader(headerValue);
        expect(result).toEqual(expected);
    });
    it('determineScope', () => {
        const urlpath = '/v2/library/alpine/manifests/latest';
        const expected = 'repository:library/alpine:pull';
        const result = sut.determineScope(urlpath);
        expect(result).toEqual(expected);
    });
})