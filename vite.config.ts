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
        // 1. Access Token만 조회하는 API
        if (req.url?.startsWith('/api/get-access-token')) {
          try {
            const keyPath = path.resolve(__dirname, 'service-account.json');
            if (!fs.existsSync(keyPath)) {
              res.statusCode = 404;
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({ 
                success: false, 
                message: 'service-account.json file not found. Please place it in the project root directory.' 
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
              accessToken: accessToken
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
              const { token, title, body: pushBody, projectId, clickAction } = JSON.parse(body);

              if (!token || !title || !pushBody || !projectId) {
                res.statusCode = 400;
                res.setHeader('Content-Type', 'application/json');
                res.end(JSON.stringify({ success: false, message: 'Missing parameters (token, title, body, projectId)' }));
                return;
              }

              // 1. service-account.json 파일 존재 여부 검사
              const keyPath = path.resolve(__dirname, 'service-account.json');
              if (!fs.existsSync(keyPath)) {
                res.statusCode = 404;
                res.setHeader('Content-Type', 'application/json');
                res.end(JSON.stringify({ 
                  success: false, 
                  message: 'service-account.json file not found. Please place it in the project root directory.' 
                }));
                return;
              }

              // 2. google-auth-library를 사용해 JWT Client 생성 및 Access Token 획득
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

              // 3. FCM v1 API 호출
              const fcmUrl = `https://fcm.googleapis.com/v1/projects/${projectId}/messages:send`;
              
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
                    link: clickAction,
                    deepLink: clickAction
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
