const fs = require('fs');
const path = require('path');

/**
 * Reads the logo from server/assets and converts it to base64.
 * Base64 is required for html-pdf (PhantomJS) to reliably render images
 * across different OS environments (Windows, Linux, etc.) without pathing issues.
 */
const getLogoBase64 = () => {
    try {
        const logoPath = path.join(__dirname, '..', 'assets', 'logo.png');
        if (fs.existsSync(logoPath)) {
            const bitmap = fs.readFileSync(logoPath);
            return `data:image/png;base64,${bitmap.toString('base64')}`;
        } else {
            console.warn(`[PDF Helper] Logo not found at ${logoPath}`);
        }
    } catch (err) {
        console.error("[PDF Helper] Error loading logo for PDF:", err);
    }
    return ''; // fallback if no logo
};

/**
 * Generates the common HTML header for all PDFs.
 * @param {string} documentTitle (Optional) title of the document (e.g., 'Tax Invoice')
 */
const getPdfHeader = (documentTitle = '') => {
    const logoSrc = getLogoBase64();
    return `
        <div style="font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; padding-bottom: 15px; border-bottom: 2px solid #f3f4f6; margin-bottom: 20px;">
            <table style="width: 100%; border-collapse: collapse;">
                <tr>
                    <td style="width: 50%; vertical-align: top;">
                        ${logoSrc
            ? `<img src="${logoSrc}" alt="Spring Blossoms Florist Logo" style="height: 60px; object-fit: contain;" />`
            : `<h1 style="color: #1a56db; margin: 0; font-size: 24px;">Spring Blossoms Florist</h1>`
        }
                    </td>
                    <td style="width: 50%; vertical-align: top; text-align: right;">
                        <div style="color: #4b5563; font-size: 11px; line-height: 1.4;">
                            <strong style="font-size: 14px; color: #111827;">Spring Blossoms Florist</strong><br>
                            Nizam Building, Rethiboli<br>
                            Hyderabad, Telangana 500028<br>
                            Phone: +91 9949683222<br>
                            Website: sbflorist.in
                        </div>
                    </td>
                </tr>
            </table>
            ${documentTitle ? `
            <div style="text-align: right; margin-top: 15px;">
                <h2 style="margin: 0; color: #4b5563; font-size: 18px; text-transform: uppercase; letter-spacing: 1px;">${documentTitle}</h2>
            </div>
            ` : ''}
        </div>
    `;
};

/**
 * Generates the common HTML footer for all PDFs.
 */
const getPdfFooter = () => {
    const logoSrc = getLogoBase64();
    return `
        <div style="font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; border-top: 1px solid #e5e7eb; padding-top: 10px; margin-top: 15px;">
            <table style="width: 100%; border-collapse: collapse;">
                <tr>
                    <td style="width: 33%; vertical-align: middle; text-align: left;">
                        ${logoSrc ? `<img src="${logoSrc}" alt="Logo" style="height: 18px; opacity: 0.6; filter: grayscale(100%); object-fit: contain;" />` : ''}
                    </td>
                    <td style="width: 34%; vertical-align: middle; text-align: center; color: #6b7280; font-size: 9px; letter-spacing: 0.5px;">
                        sbflorist.in &bull; Thank you for your business
                    </td>
                    <td style="width: 33%; vertical-align: middle; text-align: right; color: #9ca3af; font-size: 9px;">
                        Page {{page}} of {{pages}}
                    </td>
                </tr>
            </table>
        </div>
    `;
};

/**
 * Ensures PhantomJS binary is present in production environments.
 * If not present, downloads it dynamically from a fast, reliable mirror.
 */
const ensurePhantomJS = async () => {
    // Only download on Linux production/VPS environments
    if (process.platform !== 'linux') {
        return;
    }

    const targetBinDir = path.join(__dirname, '..', 'node_modules', 'phantomjs-prebuilt', 'lib', 'phantom', 'bin');
    const phantomPath = path.join(targetBinDir, 'phantomjs');

    if (fs.existsSync(phantomPath)) {
        console.log('[PDF Helper] ✅ PhantomJS binary already exists at:', phantomPath);
        return;
    }

    console.log('[PDF Helper] 🔍 PhantomJS binary not found. Initiating dynamic runtime download...');
    
    // Ensure target directory exists
    fs.mkdirSync(targetBinDir, { recursive: true });

    const archiveUrl = 'https://npmmirror.com/mirrors/phantomjs/phantomjs-2.1.1-linux-x86_64.tar.bz2';
    const tempArchive = path.join(__dirname, '..', 'scratch', 'phantomjs.tar.bz2');
    
    // Ensure scratch directory exists
    fs.mkdirSync(path.dirname(tempArchive), { recursive: true });

    console.log(`[PDF Helper] 📥 Downloading PhantomJS from mirror: ${archiveUrl}`);
    
    try {
        await new Promise((resolve, reject) => {
            const https = require('https');
            const http = require('http');
            
            const download = (currentUrl) => {
                const client = currentUrl.startsWith('https') ? https : http;
                
                client.get(currentUrl, (response) => {
                    // Handle redirects (status codes 300-399)
                    if (response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
                        const redirectUrl = new URL(response.headers.location, currentUrl).href;
                        console.log(`[PDF Helper] 🔄 Following redirect to: ${redirectUrl}`);
                        download(redirectUrl);
                        return;
                    }
                    
                    if (response.statusCode !== 200) {
                        reject(new Error(`Failed to download PhantomJS: Status ${response.statusCode}`));
                        return;
                    }
                    
                    const file = fs.createWriteStream(tempArchive);
                    response.pipe(file);
                    file.on('finish', () => {
                        file.close();
                        resolve();
                    });
                }).on('error', (err) => {
                    fs.unlink(tempArchive, () => {});
                    reject(err);
                });
            };
            
            download(archiveUrl);
        });

        console.log('[PDF Helper] 📦 Extracting PhantomJS binary archive...');
        const { execSync } = require('child_process');
        
        // Extract only the bin/phantomjs executable directly into the target directory
        execSync(`tar -xjf "${tempArchive}" -C "${targetBinDir}" --strip-components=2 "phantomjs-2.1.1-linux-x86_64/bin/phantomjs"`);
        console.log('[PDF Helper] 🗑️ Cleaning up archive file...');
        fs.unlinkSync(tempArchive);
        
        if (fs.existsSync(phantomPath)) {
            fs.chmodSync(phantomPath, '755');
            console.log('[PDF Helper] 🎉 PhantomJS successfully downloaded, extracted, and configured at:', phantomPath);
        } else {
            throw new Error('phantomjs binary not found after extraction');
        }
    } catch (err) {
        console.error('[PDF Helper] ❌ Failed to dynamically retrieve PhantomJS:', err.message);
        // Clean up temp file on failure
        if (fs.existsSync(tempArchive)) {
            try { fs.unlinkSync(tempArchive); } catch (e) {}
        }
        throw err;
    }
};

/**
 * Returns standardized options for html-pdf, injecting the professional letterhead.
 * @param {Object} options Config object { documentTitle, ...additionalOptions }
 */
const getPdfOptions = ({ documentTitle, ...additionalOptions } = {}) => {
    const pdfOptions = {
        format: 'A4',
        orientation: 'portrait',
        border: {
            top: '8mm',
            right: '15mm',
            bottom: '8mm',
            left: '15mm'
        },
        header: {
            height: documentTitle ? '50mm' : '40mm', // Adjust height based on whether title is present
            contents: getPdfHeader(documentTitle)
        },
        footer: {
            height: '25mm', // Tighter footer
            contents: getPdfFooter()
        },
        type: 'pdf',
        quality: '75',
        httpHeaders: {
            'Content-Type': 'text/html; charset=utf-8'
        },
        ...additionalOptions
    };

    // Resolve the locally downloaded phantomjs binary path (used by ensurePhantomJS)
    const localPhantomPath = path.join(__dirname, '..', 'node_modules', 'phantomjs-prebuilt', 'lib', 'phantom', 'bin', 'phantomjs');
    if (fs.existsSync(localPhantomPath)) {
        pdfOptions.phantomPath = localPhantomPath;
    } else if (process.env.PHANTOM_PATH) {
        pdfOptions.phantomPath = process.env.PHANTOM_PATH;
    }

    return pdfOptions;
};

module.exports = {
    getPdfHeader,
    getPdfFooter,
    getPdfOptions,
    getLogoBase64,
    ensurePhantomJS
};
