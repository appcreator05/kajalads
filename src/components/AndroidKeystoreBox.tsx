import React, { useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { generateRealForgeKeystore, GeneratedKeystoreResult } from '../utils/keystoreGenerator';
import { downloadBlobOrFile } from '../utils/fileDownloader';

interface AndroidKeystoreBoxProps {
  onKeystoreReady?: (result: GeneratedKeystoreResult) => void;
  className?: string;
  isCompact?: boolean;
}

export const AndroidKeystoreBox: React.FC<AndroidKeystoreBoxProps> = ({
  onKeystoreReady,
  className = '',
  isCompact = false,
}) => {
  const [showPassword, setShowPassword] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string>('');
  const [statusColor, setStatusColor] = useState<string>('');

  const keyAlias = 'appcreator05';
  const password = 'appcreator';
  const commonName = 'appcreator05 Developer';
  const organization = 'appcreator05';
  const countryCode = 'US';

  const handleGenerateKeystore = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isGenerating) return;

    setIsGenerating(true);
    setStatusColor('#0056b3');
    setStatusMessage('Generating Keystore... (Please wait)');

    try {
      // Execute genuine Forge 2048-bit RSA PKCS#12 generator
      const result = await generateRealForgeKeystore({
        alias: keyAlias,
        password: password,
        name: commonName,
        org: organization,
        country: countryCode,
        validityYears: 25,
        fileName: 'AppCreator05.keystore',
      });

      // Trigger automatic browser download
      await downloadBlobOrFile(result.blob, 'AppCreator05.keystore', 'application/x-pkcs12', true);

      setStatusColor('green');
      setStatusMessage('Keystore downloaded successfully!');

      if (onKeystoreReady) {
        onKeystoreReady(result);
      }
    } catch (err) {
      console.error('Keystore generation error:', err);
      setStatusColor('red');
      setStatusMessage('Generation failed. Try again.');
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className={`w-full ${className}`}>
      {/* Scoped CSS styling matching user specifications */}
      <style>{`
        .keystore-box {
          max-width: 450px;
          margin: 10px auto;
          padding: 24px;
          border: 1px solid #e0e0e0;
          border-radius: 12px;
          box-shadow: 0 4px 14px rgba(0,0,0,0.06);
          background-color: #ffffff;
          font-family: Arial, sans-serif;
          color: #333333;
        }
        .keystore-box h3 {
          margin-top: 0;
          margin-bottom: 20px;
          text-align: center;
          color: #1e293b;
          font-size: 18px;
          font-weight: bold;
        }
        .ks-form-group {
          margin-bottom: 14px;
        }
        .ks-form-group label {
          display: block;
          margin-bottom: 6px;
          font-weight: bold;
          color: #475569;
          font-size: 13px;
        }
        .ks-form-group input {
          width: 100% !important;
          padding: 10px 12px !important;
          box-sizing: border-box !important;
          border: 1px solid #cbd5e1 !important;
          border-radius: 6px !important;
          background-color: #f8f9fa !important;
          color: #334155 !important;
          font-size: 14px !important;
          cursor: not-allowed !important;
        }
        .ks-password-wrapper {
          position: relative;
        }
        .ks-password-wrapper input {
          padding-right: 42px !important;
        }
        .ks-toggle-eye {
          position: absolute;
          right: 12px;
          top: 50%;
          transform: translateY(-50%);
          cursor: pointer;
          color: #64748b;
          font-size: 16px;
          background: transparent;
          border: none;
          padding: 0;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .ks-toggle-eye:hover {
          color: #1e293b;
        }
        .ks-btn {
          width: 100%;
          padding: 13px;
          background-color: #28a745;
          color: #ffffff;
          border: none;
          border-radius: 6px;
          font-size: 15px;
          font-weight: bold;
          cursor: pointer;
          transition: background-color 0.25s ease, transform 0.1s ease;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
        }
        .ks-btn:hover:not(:disabled) {
          background-color: #218838;
        }
        .ks-btn:active:not(:disabled) {
          transform: scale(0.99);
        }
        .ks-btn:disabled {
          background-color: #6c757d;
          cursor: not-allowed;
          opacity: 0.85;
        }
        #ks-status {
          margin-top: 15px;
          font-weight: bold;
          text-align: center;
          font-size: 14px;
          min-height: 20px;
        }
      `}</style>

      <div className="keystore-box">
        <h3>Android Keystore Generator</h3>
        <form id="keystoreForm" onSubmit={handleGenerateKeystore}>
          <div className="ks-form-group">
            <label>Key Alias:</label>
            <input
              type="text"
              value={keyAlias}
              readOnly
              onKeyDown={(e) => e.preventDefault()}
            />
          </div>

          <div className="ks-form-group">
            <label>Password:</label>
            <div className="ks-password-wrapper">
              <input
                type={showPassword ? 'text' : 'password'}
                id="ksPassword"
                value={password}
                readOnly
                onKeyDown={(e) => e.preventDefault()}
              />
              <button
                type="button"
                className="ks-toggle-eye"
                id="ksTogglePassword"
                onClick={() => setShowPassword(!showPassword)}
                aria-label="Toggle password visibility"
              >
                {showPassword ? (
                  <EyeOff className="w-4 h-4" />
                ) : (
                  <Eye className="w-4 h-4" />
                )}
              </button>
            </div>
          </div>

          <div className="ks-form-group">
            <label>First &amp; Last Name (CN):</label>
            <input
              type="text"
              value={commonName}
              readOnly
              onKeyDown={(e) => e.preventDefault()}
            />
          </div>

          <div className="ks-form-group">
            <label>Organization (O):</label>
            <input
              type="text"
              value={organization}
              readOnly
              onKeyDown={(e) => e.preventDefault()}
            />
          </div>

          <div className="ks-form-group">
            <label>Country Code (C):</label>
            <input
              type="text"
              value={countryCode}
              readOnly
              onKeyDown={(e) => e.preventDefault()}
            />
          </div>

          <button
            type="submit"
            id="ksBtn"
            className="ks-btn"
            disabled={isGenerating}
          >
            {isGenerating ? 'Generating Keystore...' : 'Generate & Download Keystore'}
          </button>
        </form>

        <div id="ks-status" style={{ color: statusColor }}>
          {statusMessage}
        </div>
      </div>
    </div>
  );
};
