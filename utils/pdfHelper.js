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
                            Phone: +91 9849589710<br>
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
 * Returns standardized options for html-pdf, injecting the professional letterhead.
 * @param {Object} options Config object { documentTitle, ...additionalOptions }
 */
const getPdfOptions = ({ documentTitle, ...additionalOptions } = {}) => {
    return {
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
};

module.exports = {
    getPdfHeader,
    getPdfFooter,
    getPdfOptions,
    getLogoBase64
};
