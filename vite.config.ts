import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { JWT } from 'google-auth-library';
import fs from 'fs';
import path from 'path';

// FCM API 전송을 대행할 로컬 미들웨어 플러그인
function fcmPushPlugin() {
  return {
    name: 'fcm-push-plugin',
    configureServer(server: any) {
      server.middlewares.use(async (req: any, res: any, next: any) => {
        // 0. Project 정보만 빠르게 조회하는 API
        if (req.url?.startsWith('/api/get-project-info')) {
          try {
            const parsedUrl = new URL(req.url, 'http://localhost');
            const env = parsedUrl.searchParams.get('env') || 'dev';

            let keyPath = '';
            if (env === 'prod') {
              keyPath = path.resolve(__dirname, 'service-account-prod.json');
            } else {
              const devPath = path.resolve(__dirname, 'service-account-dev.json');
              const legacyPath = path.resolve(__dirname, 'service-account.json');
              keyPath = fs.existsSync(devPath) ? devPath : legacyPath;
            }

            if (!fs.existsSync(keyPath)) {
              res.statusCode = 404;
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({ 
                success: false, 
                message: `Credentials file for '${env}' environment not found.` 
              }));
              return;
            }

            const keyFile = JSON.parse(fs.readFileSync(keyPath, 'utf8'));
            res.statusCode = 200;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({
              success: true,
              projectId: keyFile.project_id
            }));
          } catch (error: any) {
            res.statusCode = 500;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ 
              success: false, 
              message: error.message || 'Internal Server Error' 
            }));
          }
          return;
        }

        // 1. Access Token만 조회하는 API
        if (req.url?.startsWith('/api/get-access-token')) {
          try {
            const parsedUrl = new URL(req.url, 'http://localhost');
            const env = parsedUrl.searchParams.get('env') || 'dev';

            let keyPath = '';
            if (env === 'prod') {
              keyPath = path.resolve(__dirname, 'service-account-prod.json');
            } else {
              const devPath = path.resolve(__dirname, 'service-account-dev.json');
              const legacyPath = path.resolve(__dirname, 'service-account.json');
              keyPath = fs.existsSync(devPath) ? devPath : legacyPath;
            }

            if (!fs.existsSync(keyPath)) {
              res.statusCode = 404;
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({ 
                success: false, 
                message: `Credentials file for '${env}' environment not found. Please place '${path.basename(keyPath)}' in the project root.` 
              }));
              return;
            }

            const keyFile = JSON.parse(fs.readFileSync(keyPath, 'utf8'));
            const jwtClient = new JWT({
              email: keyFile.client_email,
              key: keyFile.private_key,
              scopes: ['https://www.googleapis.com/auth/firebase.messaging'],
            });

            const credentials = await jwtClient.getAccessToken();
            const accessToken = credentials.token;

            if (!accessToken) {
              throw new Error('Failed to retrieve Google OAuth2 access token.');
            }

            res.statusCode = 200;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({
              success: true,
              accessToken: accessToken,
              projectId: keyFile.project_id
            }));
          } catch (error: any) {
            res.statusCode = 500;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ 
              success: false, 
              message: error.message || 'Internal Server Error' 
            }));
          }
          return;
        }

        // 2. 푸시 발송을 요청하는 API
        if (req.url?.startsWith('/api/send-push')) {
          if (req.method !== 'POST') {
            res.statusCode = 405;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ success: false, message: 'Method Not Allowed' }));
            return;
          }

          // request body 읽기
          let body = '';
          req.on('data', (chunk: any) => {
            body += chunk;
          });

          req.on('end', async () => {
            try {
              const { token, title, body: pushBody, clickAction, env, badge } = JSON.parse(body);

              if (!token || !title || !pushBody) {
                res.statusCode = 400;
                res.setHeader('Content-Type', 'application/json');
                res.end(JSON.stringify({ success: false, message: 'Missing parameters (token, title, body)' }));
                return;
              }

              // 1. service-account Key 파일 로드
              const targetEnv = env || 'dev';
              let keyPath = '';
              if (targetEnv === 'prod') {
                keyPath = path.resolve(__dirname, 'service-account-prod.json');
              } else {
                const devPath = path.resolve(__dirname, 'service-account-dev.json');
                const legacyPath = path.resolve(__dirname, 'service-account.json');
                keyPath = fs.existsSync(devPath) ? devPath : legacyPath;
              }

              if (!fs.existsSync(keyPath)) {
                res.statusCode = 404;
                res.setHeader('Content-Type', 'application/json');
                res.end(JSON.stringify({ 
                  success: false, 
                  message: `Credentials file for '${targetEnv}' environment not found. Please place '${path.basename(keyPath)}' in the project root.` 
                }));
                return;
              }

              // 2. google-auth-library를 사용해 JWT Client 생성 및 Access Token 획득
              const keyFile = JSON.parse(fs.readFileSync(keyPath, 'utf8'));
              const resolvedProjectId = keyFile.project_id;
              
              if (!resolvedProjectId) {
                throw new Error('Firebase project_id not found in the credentials file.');
              }

              const jwtClient = new JWT({
                email: keyFile.client_email,
                key: keyFile.private_key,
                scopes: ['https://www.googleapis.com/auth/firebase.messaging'],
              });

              const credentials = await jwtClient.getAccessToken();
              const accessToken = credentials.token;

              if (!accessToken) {
                throw new Error('Failed to retrieve Google OAuth2 access token.');
              }

              // 3. FCM v1 API 호출
              const fcmUrl = `https://fcm.googleapis.com/v1/projects/${resolvedProjectId}/messages:send`;
              
              // iOS 배지는 APNs 전용 필드라 apns 블록을 거쳐야 한다.
              // message 바로 아래에 aps 를 넣으면 FCM 이 거부한다.
              // Android 는 이 블록을 통째로 무시하므로 배지 확인은 iOS 에서만 가능하다.
              // 빈 문자열은 Number() 가 0 으로 바꿔버린다. 0 은 "배지 지우기" 라는 유효한
              // 값이므로, 미입력과 구분하려면 빈 값을 먼저 걷어내야 한다.
              const badgeRaw = typeof badge === 'string' ? badge.trim() : badge;
              const badgeCount = Number(badgeRaw);
              const hasBadge =
                badgeRaw !== '' &&
                badgeRaw !== null &&
                badgeRaw !== undefined &&
                Number.isInteger(badgeCount) &&
                badgeCount >= 0;

              // data payload에 click_action 및 url 설정
              const fcmPayload = {
                message: {
                  token: token,
                  notification: {
                    title: title,
                    body: pushBody
                  },
                  data: clickAction ? {
                    click_action: clickAction,
                    url: clickAction,
                    deepLink: clickAction
                  } : undefined,
                  apns: hasBadge ? {
                    payload: {
                      aps: {
                        badge: badgeCount
                      }
                    }
                  } : undefined
                }
              };

              const fcmResponse = await fetch(fcmUrl, {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  'Authorization': `Bearer ${accessToken}`
                },
                body: JSON.stringify(fcmPayload)
              });

              const fcmResult = await fcmResponse.json();

              res.statusCode = fcmResponse.status;
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({
                success: fcmResponse.ok,
                status: fcmResponse.status,
                accessToken: accessToken,
                projectId: resolvedProjectId,
                data: fcmResult
              }));

            } catch (error: any) {
              res.statusCode = 500;
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({ 
                success: false, 
                message: error.message || 'Internal Server Error' 
              }));
            }
          });
          return;
        }

        // 3. 파일 업로드를 요청하는 API
        if (req.url?.startsWith('/api/upload')) {
          if (req.method !== 'POST') {
            res.statusCode = 405;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ success: false, message: 'Method Not Allowed' }));
            return;
          }

          const chunks: any[] = [];
          req.on('data', (chunk: any) => {
            chunks.push(chunk);
          });

          req.on('end', () => {
            try {
              const buffer = Buffer.concat(chunks);
              const contentType = req.headers['content-type'] || '';
              const boundaryMatch = contentType.match(/boundary=(?:"([^"]+)"|([^;]+))/);
              if (!boundaryMatch) {
                throw new Error('Multipart boundary not found');
              }
              const boundary = boundaryMatch[1] || boundaryMatch[2];
              const boundaryBuffer = Buffer.from(`--${boundary}`);
              
              // upload 디렉토리 생성
              const uploadDir = path.resolve(__dirname, 'upload');
              if (!fs.existsSync(uploadDir)) {
                fs.mkdirSync(uploadDir, { recursive: true });
              }

              const savedFiles: { filename: string; size: number; contentType: string; path: string }[] = [];
              
              let index = 0;
              while (true) {
                const nextBoundaryIndex = buffer.indexOf(boundaryBuffer, index);
                if (nextBoundaryIndex === -1) break;
                
                const partStart = nextBoundaryIndex + boundaryBuffer.length;
                const nextBoundaryIndex2 = buffer.indexOf(boundaryBuffer, partStart);
                if (nextBoundaryIndex2 === -1) break;
                
                const partData = buffer.slice(partStart, nextBoundaryIndex2);
                
                // 파트 헤더와 바디 분리 (\r\n\r\n)
                const headerEnd = partData.indexOf(Buffer.from('\r\n\r\n'));
                if (headerEnd !== -1) {
                  const headerStr = partData.slice(0, headerEnd).toString('utf8');
                  
                  let bodyEnd = partData.length;
                  if (partData.slice(bodyEnd - 2).toString() === '\r\n') {
                    bodyEnd -= 2;
                  }
                  
                  const bodyData = partData.slice(headerEnd + 4, bodyEnd);
                  
                  if (bodyData.length > 0) {
                    const filenameMatch = headerStr.match(/filename="([^"]+)"/i);
                    const contentTypeMatch = headerStr.match(/Content-Type:\s*([^\r\n]+)/i);
                    
                    if (filenameMatch) {
                      const originalFilename = filenameMatch[1];
                      const fileExt = path.extname(originalFilename);
                      const fileBase = path.basename(originalFilename, fileExt);
                      const uniqueFilename = `${fileBase}_${Date.now()}${fileExt}`;
                      const savePath = path.join(uploadDir, uniqueFilename);
                      
                      fs.writeFileSync(savePath, bodyData);
                      
                      savedFiles.push({
                        filename: originalFilename,
                        size: bodyData.length,
                        contentType: contentTypeMatch ? contentTypeMatch[1].trim() : 'application/octet-stream',
                        path: `/upload/${uniqueFilename}`
                      });
                    }
                  }
                }
                index = nextBoundaryIndex2;
              }

              res.statusCode = 200;
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({
                success: true,
                message: 'Files uploaded successfully',
                files: savedFiles
              }));
            } catch (error: any) {
              res.statusCode = 500;
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({
                success: false,
                message: error.message || 'Internal Server Error'
              }));
            }
          });
          return;
        }
        next();
      });
    }
  };
}

export default defineConfig({
  plugins: [react(), fcmPushPlugin()],
  server: {
    port: 5173,
  },
});
