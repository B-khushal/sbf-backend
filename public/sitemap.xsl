<?xml version="1.0" encoding="UTF-8"?>
<xsl:stylesheet version="1.0"
  xmlns:xsl="http://www.w3.org/1999/XSL/Transform"
  xmlns:sitemap="http://www.sitemaps.org/schemas/sitemap/0.9"
  xmlns:image="http://www.google.com/schemas/sitemap-image/1.1"
  exclude-result-prefixes="sitemap image">
  <xsl:output method="html" encoding="UTF-8" indent="yes" />

  <xsl:template match="/">
    <html lang="en">
      <head>
        <meta charset="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>
          <xsl:choose>
            <xsl:when test="sitemap:sitemapindex">XML Sitemap Index | Spring Blossoms Florist</xsl:when>
            <xsl:otherwise>XML Sitemap | Spring Blossoms Florist</xsl:otherwise>
          </xsl:choose>
        </title>
        <style>
          *, *::before, *::after {
            box-sizing: border-box;
            margin: 0;
            padding: 0;
          }
          body {
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Inter", "Helvetica Neue", Arial, sans-serif;
            background-color: #faf8f5;
            color: #1e293b;
            line-height: 1.5;
            padding: 24px 16px 64px;
          }
          .container {
            max-width: 1200px;
            margin: 0 auto;
          }
          .header-card {
            background: #ffffff;
            border: 1px solid #e2e8f0;
            border-radius: 16px;
            padding: 28px 32px;
            margin-bottom: 24px;
            box-shadow: 0 1px 3px rgba(0,0,0,0.05);
          }
          .brand-row {
            display: flex;
            align-items: center;
            justify-content: space-between;
            flex-wrap: wrap;
            gap: 16px;
            margin-bottom: 16px;
          }
          .brand-title {
            font-size: 26px;
            font-weight: 800;
            color: #be123c;
            letter-spacing: -0.02em;
          }
          .brand-tagline {
            font-size: 13px;
            font-weight: 600;
            color: #9f1239;
            background: #ffe4e6;
            padding: 4px 12px;
            border-radius: 9999px;
            display: inline-block;
          }
          .intro-text {
            color: #475569;
            font-size: 15px;
            line-height: 1.6;
            margin-bottom: 20px;
          }
          .cta-banner {
            background: linear-gradient(135deg, #fff1f2 0%, #ffe4e6 100%);
            border: 1px solid #fecdd3;
            border-radius: 12px;
            padding: 16px 20px;
            display: flex;
            align-items: center;
            justify-content: space-between;
            flex-wrap: wrap;
            gap: 12px;
          }
          .cta-text {
            font-size: 14px;
            font-weight: 600;
            color: #881337;
          }
          .cta-btn {
            display: inline-flex;
            align-items: center;
            gap: 6px;
            background: #e11d48;
            color: #ffffff !important;
            text-decoration: none;
            font-size: 13px;
            font-weight: 700;
            padding: 8px 16px;
            border-radius: 8px;
            transition: background 0.2s ease;
          }
          .cta-btn:hover {
            background: #be123c;
          }
          .stats-bar {
            display: flex;
            gap: 16px;
            flex-wrap: wrap;
            margin-top: 16px;
            font-size: 13px;
            color: #64748b;
          }
          .stat-pill {
            background: #f1f5f9;
            padding: 4px 12px;
            border-radius: 6px;
            font-weight: 600;
            color: #334155;
          }
          .table-card {
            background: #ffffff;
            border: 1px solid #e2e8f0;
            border-radius: 16px;
            overflow: hidden;
            box-shadow: 0 1px 3px rgba(0,0,0,0.05);
          }
          table {
            width: 100%;
            border-collapse: collapse;
            text-align: left;
            font-size: 14px;
          }
          thead {
            background: #f8fafc;
            border-bottom: 1px solid #e2e8f0;
          }
          th {
            padding: 14px 18px;
            font-weight: 700;
            color: #334155;
            font-size: 12px;
            text-transform: uppercase;
            letter-spacing: 0.05em;
          }
          td {
            padding: 12px 18px;
            border-bottom: 1px solid #f1f5f9;
            color: #1e293b;
            vertical-align: middle;
          }
          tr:hover td {
            background: #fff8f8;
          }
          .url-link {
            color: #be123c;
            text-decoration: none;
            font-weight: 500;
            word-break: break-all;
          }
          .url-link:hover {
            text-decoration: underline;
            color: #9f1239;
          }
          .badge {
            display: inline-block;
            font-size: 11px;
            font-weight: 700;
            padding: 2px 8px;
            border-radius: 4px;
            text-transform: uppercase;
          }
          .badge-index {
            background: #e0f2fe;
            color: #0369a1;
          }
          .badge-image {
            background: #dcfce7;
            color: #15803d;
          }
          .date-cell {
            color: #64748b;
            font-family: monospace;
            font-size: 13px;
            white-space: nowrap;
          }
          .num-cell {
            color: #94a3b8;
            font-weight: 600;
            font-size: 12px;
            width: 50px;
          }
          .footer-note {
            text-align: center;
            margin-top: 24px;
            font-size: 13px;
            color: #94a3b8;
          }
          .footer-note a {
            color: #be123c;
            text-decoration: none;
            font-weight: 600;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header-card">
            <div class="brand-row">
              <div>
                <div class="brand-title">Spring Blossoms Florist</div>
                <div style="font-size: 14px; color: #64748b; margin-top: 2px;">
                  <xsl:choose>
                    <xsl:when test="sitemap:sitemapindex">XML Sitemap Index (Google &amp; Search Engine Directory)</xsl:when>
                    <xsl:otherwise>XML Sitemap (Search Engine URL Set)</xsl:otherwise>
                  </xsl:choose>
                </div>
              </div>
              <div class="brand-tagline">A Reason to Express</div>
            </div>

            <p class="intro-text">
              <xsl:choose>
                <xsl:when test="sitemap:sitemapindex">
                  This XML Sitemap Index is automatically generated to assist search engines like Google and Bing in crawling all eligible public URLs of <strong>Spring Blossoms Florist</strong>.
                </xsl:when>
                <xsl:otherwise>
                  This XML Sitemap is automatically generated for search engine indexing. Back to <a href="/sitemap.xml" style="color:#be123c; font-weight:600;">Sitemap Index (/sitemap.xml)</a>.
                </xsl:otherwise>
              </xsl:choose>
            </p>

            <div class="cta-banner">
              <div class="cta-text">
                🌸 <strong>Looking for our visual store directory?</strong> Explore our interactive HTML Sitemap with live search and category browsing:
              </div>
              <a href="/sitemap" class="cta-btn">
                Visit Interactive HTML Sitemap →
              </a>
            </div>

            <div class="stats-bar">
              <xsl:choose>
                <xsl:when test="sitemap:sitemapindex">
                  <span class="stat-pill">
                    Sitemaps in Index: <xsl:value-of select="count(sitemap:sitemapindex/sitemap:sitemap)" />
                  </span>
                </xsl:when>
                <xsl:otherwise>
                  <span class="stat-pill">
                    Total URLs: <xsl:value-of select="count(sitemap:urlset/sitemap:url)" />
                  </span>
                </xsl:otherwise>
              </xsl:choose>
              <span class="stat-pill">Protocol: Sitemap 0.9</span>
              <span class="stat-pill">Host: sbflorist.in</span>
            </div>
          </div>

          <div class="table-card">
            <xsl:choose>
              <!-- SITEMAP INDEX TABLE -->
              <xsl:when test="sitemap:sitemapindex">
                <table>
                  <thead>
                    <tr>
                      <th class="num-cell">#</th>
                      <th>Sitemap File Location</th>
                      <th>Type</th>
                      <th>Last Modified</th>
                    </tr>
                  </thead>
                  <tbody>
                    <xsl:for-each select="sitemap:sitemapindex/sitemap:sitemap">
                      <tr>
                        <td class="num-cell"><xsl:value-of select="position()" /></td>
                        <td>
                          <a class="url-link">
                            <xsl:attribute name="href">
                              <xsl:value-of select="sitemap:loc" />
                            </xsl:attribute>
                            <xsl:value-of select="sitemap:loc" />
                          </a>
                        </td>
                        <td>
                          <span class="badge badge-index">Child Sitemap</span>
                        </td>
                        <td class="date-cell">
                          <xsl:value-of select="sitemap:lastmod" />
                        </td>
                      </tr>
                    </xsl:for-each>
                  </tbody>
                </table>
              </xsl:when>

              <!-- URLSET TABLE -->
              <xsl:otherwise>
                <table>
                  <thead>
                    <tr>
                      <th class="num-cell">#</th>
                      <th>URL Destination</th>
                      <th>Google Images</th>
                      <th>Last Modified</th>
                    </tr>
                  </thead>
                  <tbody>
                    <xsl:for-each select="sitemap:urlset/sitemap:url">
                      <tr>
                        <td class="num-cell"><xsl:value-of select="position()" /></td>
                        <td>
                          <a class="url-link">
                            <xsl:attribute name="href">
                              <xsl:value-of select="sitemap:loc" />
                            </xsl:attribute>
                            <xsl:value-of select="sitemap:loc" />
                          </a>
                        </td>
                        <td>
                          <xsl:choose>
                            <xsl:when test="image:image">
                              <span class="badge badge-image">
                                <xsl:value-of select="count(image:image)" /> Image(s)
                              </span>
                            </xsl:when>
                            <xsl:otherwise>
                              <span style="color: #94a3b8; font-size: 12px;">—</span>
                            </xsl:otherwise>
                          </xsl:choose>
                        </td>
                        <td class="date-cell">
                          <xsl:value-of select="sitemap:lastmod" />
                        </td>
                      </tr>
                    </xsl:for-each>
                  </tbody>
                </table>
              </xsl:otherwise>
            </xsl:choose>
          </div>

          <div class="footer-note">
            Spring Blossoms Florist &#169; 2026. All rights reserved. | <a href="/sitemap">HTML Sitemap</a> | <a href="/shop">Shop Flowers</a> | <a href="/flower-delivery-hyderabad">Hyderabad Flower Delivery</a>
          </div>
        </div>
      </body>
    </html>
  </xsl:template>
</xsl:stylesheet>
