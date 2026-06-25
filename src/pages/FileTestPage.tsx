import { useState, ChangeEvent } from 'react';

type FileTestPageProps = {
  onBack: () => void;
};

interface FileInfo {
  name: string;
  size: number;
  type: string;
  previewUrl?: string;
  rawFile: File;
}

export function FileTestPage({ onBack }: FileTestPageProps) {
  const [singleFile, setSingleFile] = useState<FileInfo | null>(null);
  const [multiFiles, setMultiFiles] = useState<FileInfo[]>([]);
  const [cameraFile, setCameraFile] = useState<FileInfo | null>(null);
  const [realUploadProgress, setRealUploadProgress] = useState<number | null>(null);
  const [isRealUploading, setIsRealUploading] = useState<boolean>(false);
  const [uploadedResults, setUploadedResults] = useState<{ filename: string; size: number; contentType: string; path: string }[]>([]);

  const handleSingleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) {
      setSingleFile(null);
      return;
    }

    const fileInfo: FileInfo = {
      name: file.name,
      size: file.size,
      type: file.type,
      previewUrl: file.type.startsWith('image/') ? URL.createObjectURL(file) : undefined,
      rawFile: file
    };
    setSingleFile(fileInfo);
  };

  const handleMultiFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) {
      setMultiFiles([]);
      return;
    }

    const fileList: FileInfo[] = Array.from(files).map(file => ({
      name: file.name,
      size: file.size,
      type: file.type,
      previewUrl: file.type.startsWith('image/') ? URL.createObjectURL(file) : undefined,
      rawFile: file
    }));
    setMultiFiles(fileList);
  };

  const handleCameraFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) {
      setCameraFile(null);
      return;
    }

    const fileInfo: FileInfo = {
      name: file.name,
      size: file.size,
      type: file.type,
      previewUrl: file.type.startsWith('image/') ? URL.createObjectURL(file) : undefined,
      rawFile: file
    };
    setCameraFile(fileInfo);
  };


  const handleRealUpload = () => {
    const filesToUpload: File[] = [];
    if (singleFile) filesToUpload.push(singleFile.rawFile);
    if (multiFiles.length > 0) multiFiles.forEach(f => filesToUpload.push(f.rawFile));
    if (cameraFile) filesToUpload.push(cameraFile.rawFile);

    if (filesToUpload.length === 0) {
      alert('업로드할 파일을 먼저 선택해주세요.');
      return;
    }

    setIsRealUploading(true);
    setRealUploadProgress(0);
    setUploadedResults([]);

    const formData = new FormData();
    filesToUpload.forEach(file => {
      formData.append('files', file);
    });

    const xhr = new XMLHttpRequest();
    xhr.open('POST', '/api/upload');

    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) {
        const percentage = Math.round((event.loaded / event.total) * 100);
        setRealUploadProgress(percentage);
      }
    };

    xhr.onload = () => {
      if (xhr.status === 200) {
        try {
          const response = JSON.parse(xhr.responseText);
          if (response.success) {
            setUploadedResults(response.files || []);
            alert('OK');
          } else {
            alert('Fail : ' + response.message);
          }
        } catch (e) {
          alert('응답 파싱 에러');
        }
      } else {
        alert('Fail : HTTP ' + xhr.status);
      }
      setIsRealUploading(false);
      setRealUploadProgress(null);
    };

    xhr.onerror = () => {
      alert('네트워크 오류로 업로드에 실패했습니다.');
      setIsRealUploading(false);
      setRealUploadProgress(null);
    };

    xhr.send(formData);
  };

  const formatSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <main className="app-shell">
      <header className="topbar">
        <div>
          <p className="eyebrow">SPC Hybrid WebView</p>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <h1>File 테스트</h1>
            <button className="secondary" onClick={onBack} style={{ minHeight: '32px', height: '32px', padding: '0 10px', fontSize: '14px' }}>
              Back
            </button>
          </div>
        </div>
      </header>

      <div className="content-grid">
        {/* 1. 단일 파일 선택 패널 */}
        <section className="panel">
          <div className="panel-heading">
            <h2>단일 파일 업로드</h2>
          </div>
          <div className="field">
            <input type="file" id="single-file-input" onChange={handleSingleFileChange} />
          </div>
          {singleFile && (
            <div style={{ marginTop: '12px', fontSize: '14px', color: '#333' }}>
              <p style={{ margin: '4px 0' }}><strong>파일명:</strong> {singleFile.name}</p>
              <p style={{ margin: '4px 0' }}><strong>크기:</strong> {formatSize(singleFile.size)}</p>
              <p style={{ margin: '4px 0' }}><strong>타입:</strong> {singleFile.type || 'N/A'}</p>
              {singleFile.previewUrl && (
                <div style={{ marginTop: '8px' }}>
                  <img src={singleFile.previewUrl} alt="Preview" style={{ maxWidth: '100%', maxHeight: '150px', borderRadius: '4px', border: '1px solid #ddd' }} />
                </div>
              )}
            </div>
          )}
        </section>

        {/* 2. 다중 파일 선택 패널 */}
        <section className="panel">
          <div className="panel-heading">
            <h2>다중 파일 업로드</h2>
          </div>
          <div className="field">
            <input type="file" id="multi-file-input" multiple onChange={handleMultiFileChange} />
          </div>
          {multiFiles.length > 0 && (
            <div style={{ marginTop: '12px', fontSize: '14px', color: '#333' }}>
              <p style={{ margin: '4px 0' }}><strong>선택된 파일 수:</strong> {multiFiles.length}개</p>
              <ul style={{ paddingLeft: '20px', margin: '8px 0' }}>
                {multiFiles.map((file, idx) => (
                  <li key={idx} style={{ marginBottom: '4px' }}>
                    {file.name} ({formatSize(file.size)})
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>

        {/* 3. 카메라 / 미디어 캡처 패널 */}
        <section className="panel">
          <div className="panel-heading">
            <h2>카메라 및 이미지 전용</h2>
          </div>
          <div className="field" style={{ marginBottom: '12px' }}>
            <label style={{ display: 'block', fontSize: '13px', fontWeight: 'bold', color: '#666', marginBottom: '4px' }}>이미지 + 카메라 구동 통합 (accept="image/*")</label>
            <input type="file" accept="image/*" onChange={handleCameraFileChange} />
          </div>
          <div className="field">
            <label style={{ display: 'block', fontSize: '13px', fontWeight: 'bold', color: '#666', marginBottom: '4px' }}>카메라 직접 구동 (accept="image/*" capture="environment")</label>
            <input type="file" accept="image/*" capture="environment" onChange={handleCameraFileChange} />
          </div>
          {cameraFile && (
            <div style={{ marginTop: '12px', fontSize: '14px', color: '#333' }}>
              <p style={{ margin: '4px 0' }}><strong>파일명:</strong> {cameraFile.name}</p>
              <p style={{ margin: '4px 0' }}><strong>크기:</strong> {formatSize(cameraFile.size)}</p>
              {cameraFile.previewUrl && (
                <div style={{ marginTop: '8px' }}>
                  <img src={cameraFile.previewUrl} alt="Preview" style={{ maxWidth: '100%', maxHeight: '150px', borderRadius: '4px', border: '1px solid #ddd' }} />
                </div>
              )}
            </div>
          )}
        </section>

        {/* 4. 업로드 테스트 실행 패널 */}
        <section className="panel">
          <div className="panel-heading">
            <h2>업로드 테스트 실행</h2>
          </div>
          <div>
            <button className="wide" onClick={handleRealUpload} disabled={isRealUploading}>
              {isRealUploading ? '업로드 중...' : '서버 전송'}
            </button>
            {realUploadProgress !== null && (
              <div style={{ marginTop: '8px' }}>
                <div style={{ background: '#eee', borderRadius: '4px', height: '10px', overflow: 'hidden' }}>
                  <div style={{ background: '#1f6f78', height: '100%', width: `${realUploadProgress}%`, transition: 'width 0.15s ease' }} />
                </div>
                <p style={{ margin: '4px 0 0', fontSize: '12px', textAlign: 'right', color: '#666' }}>{realUploadProgress}% 완료</p>
              </div>
            )}
          </div>

          {/* 실제 업로드 결과 출력 */}
          {uploadedResults.length > 0 && (
            <div style={{ marginTop: '16px', background: '#f8fafc', padding: '12px', borderRadius: '6px', border: '1px solid #e2e8f0' }}>
              <h3 style={{ margin: '0 0 8px 0', fontSize: '15px', color: '#1a202c' }}>업로드 결과 (서버 수신 완료)</h3>
              <ul style={{ margin: 0, paddingLeft: '20px', fontSize: '13px', color: '#4a5568' }}>
                {uploadedResults.map((res, idx) => (
                  <li key={idx} style={{ marginBottom: '6px' }}>
                    <strong>파일명:</strong> {res.filename}<br />
                    <strong>크기:</strong> {formatSize(res.size)}<br />
                    <strong>저장 경로:</strong> <span style={{ fontFamily: 'monospace', color: '#e53e3e', wordBreak: 'break-all' }}>{res.path}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
