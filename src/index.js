export default {
    async fetch(request, env, ctx) {
        try {
            return await fetchWithThrowGuard(request, env, ctx);
        } catch (error) {
            if (error instanceof AppError) {
                return new Response(error.message, { status: error.statusCode });
            }
            // 处理未预期的异常
            return new Response('Internal server error', { status: 500 });
        }
    },
};

// 自定义异常类
class AppError extends Error {
    constructor(message, statusCode = 500) {
        super(message);
        this.statusCode = statusCode;
    }
}

async function fetchWithThrowGuard(request, env) {
    // 只允许读方法
    if (!['GET', 'HEAD', 'OPTIONS'].includes(request.method)) {
        throw new AppError('Method not allowed', 405);
    }

    // 获取upstream参数
    const upstream = new URL(request.url).searchParams.get('upstream');
    if (!upstream) {
        throw new AppError('Missing upstream parameter', 400);
    }
    // 检查upstream是个域名
    if (!upstream.match(/^[^/]+$/)) {
        throw new AppError('Invalid upstream parameter, expect a domain', 400);
    }

    // 准备发往upstream的请求
    const upstreamUrl = new URL(request.url);
    upstreamUrl.host = upstream;
    upstreamUrl.searchParams.delete('upstream');

    const upstreamReq = new Request(upstreamUrl.toString(),
        new Request(request, { redirect: 'manual' }));
    upstreamReq.headers.set('Host', upstream);

    // 发送初始请求
    let response = await fetch(upstreamReq);

    // 如果收到401未授权响应，进行认证流程
    if (response.status === 401) {
        const bearerToken = await fetchBearerToken(response, upstreamUrl, env);
        // 使用获取的token重新发送请求到原始upstream
        upstreamReq.headers.set('Authorization', `Bearer ${bearerToken}`);
        response = await fetch(upstreamReq);
    }

    return response;
}


async function fetchBearerToken(response401, upstreamUrl, env) {
    const authHeader = response401.headers.get('Www-Authenticate');
    if (!(authHeader && authHeader.includes('Bearer'))) {
        throw new AppError('Missing Www-Authenticate header', 401);
    }

    const authParams = parseAuthHeader(authHeader);
    const realm = authParams?.realm;
    const service = authParams?.service;
    const scope = authParams?.scope || determineScope(upstreamUrl.pathname);

    if (!realm || !service || !scope) {
        throw new AppError("Missing authentication parameters", 401);
    }

    if (env) {
        // todo: 使用KV存储token
    }

    const {token, } = await fetchBearerTokenViaService({ ...authParams, scope });
    return token;
}

export async function fetchBearerTokenViaService(authParams) {
    const tokenUrl = new URL(authParams.realm);
    tokenUrl.searchParams.set('service', authParams.service);
    tokenUrl.searchParams.set('scope', authParams.scope);

    const tokenResponse = await fetch(tokenUrl.toString());
    if (!tokenResponse.ok) {
        const text = await tokenResponse.text();
        return new AppError(`Failed to fetch token: ${text}`, tokenResponse.status);
    }

    const tokenData = await tokenResponse.json();
    const token = tokenData.token || tokenData.access_token;
    if (!token) {
        throw new AppError('Missing token in response', 401);
    }
    const expiresIn = tokenData.expires_in || 300; // 默认过期时间为300秒
    return { token, expiresIn };
}

// 解析Www-Authenticate头
export function parseAuthHeader(headerValue) {
    const params = {};
    const parts = headerValue.split(' ', 2);

    // Check if it's a Bearer auth
    if (parts[0] !== 'Bearer') {
        return params;
    }

    // Process remaining parts
    parts.slice(1).forEach(part => {
        part.split(',').forEach(param => {
            const [key, value] = param.split('=');
            if (key && value) {
                // Remove quotes
                params[key] = value.replace(/^"|"$/g, '');
            }
        })
    });

    return params;
}

// 根据请求路径确定scope
// https://distribution.github.io/distribution/spec/auth/token/
export function determineScope(urlpath) {
    // 针对不同的API端点确定合适的scope
    if (urlpath.startsWith('/v2/')) {
        if (urlpath === '/v2/') {
            // 任意字符串都行
            return 'any';
        }

        // https://docs.docker.com/registry/spec/api/
        const readOnlyEndpoints = [
            new RegExp('^/v2/(?<repo>[^/]+(?:/[^/]+)*)/blobs/'),     // Get blob
            new RegExp('^/v2/(?<repo>[^/]+(?:/[^/]+)*)/manifests/'), // Get image manifest
            new RegExp('^/v2/(?<repo>[^/]+(?:/[^/]+)*)/tags/list$'), // List image tags
        ];

        // Check each pattern and extract repo name if matched
        for (const pattern of readOnlyEndpoints) {
            const match = pattern.exec(urlpath);
            if (match && match.groups?.repo) {
                return `repository:${match.groups.repo}:pull`;
            }
        }
    }

    return null;
}
