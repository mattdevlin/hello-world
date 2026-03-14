import React from 'react';
import { renderToBuffer, Document, Page, View, Text, Image, StyleSheet } from '@react-pdf/renderer';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const LOGO_PATH = path.join(__dirname, '..', 'assets', 'devlin-property-logo.png');

const pdfStyles = StyleSheet.create({
  page: {
    padding: 50,
    fontFamily: 'Helvetica',
    fontSize: 10,
    color: '#1a1a1a',
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
    paddingBottom: 15,
    borderBottomWidth: 2,
    borderBottomColor: '#2C5F8A',
  },
  logo: {
    width: 120,
    height: 'auto',
  },
  companyInfo: {
    textAlign: 'right',
    fontSize: 9,
    color: '#555',
  },
  companyName: {
    fontSize: 14,
    fontFamily: 'Helvetica-Bold',
    color: '#2C5F8A',
    marginBottom: 3,
  },
  quoteTitle: {
    fontSize: 20,
    fontFamily: 'Helvetica-Bold',
    color: '#2C5F8A',
    marginBottom: 15,
  },
  metaRow: {
    flexDirection: 'row',
    marginBottom: 4,
  },
  metaLabel: {
    width: 100,
    fontFamily: 'Helvetica-Bold',
    fontSize: 10,
    color: '#555',
  },
  metaValue: {
    fontSize: 10,
  },
  sectionTitle: {
    fontSize: 12,
    fontFamily: 'Helvetica-Bold',
    color: '#2C5F8A',
    marginTop: 20,
    marginBottom: 8,
    paddingBottom: 4,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  clientBlock: {
    marginBottom: 10,
  },
  clientName: {
    fontSize: 12,
    fontFamily: 'Helvetica-Bold',
  },
  clientDetail: {
    fontSize: 10,
    color: '#555',
    marginTop: 2,
  },
  priceBox: {
    marginTop: 20,
    padding: 20,
    backgroundColor: '#f8f9fa',
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 4,
    alignItems: 'flex-end',
  },
  priceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: 250,
    marginBottom: 4,
  },
  priceLabel: {
    fontSize: 11,
    color: '#555',
  },
  priceValue: {
    fontSize: 11,
    fontFamily: 'Helvetica-Bold',
  },
  totalDivider: {
    width: 250,
    height: 1,
    backgroundColor: '#1a1a1a',
    marginVertical: 6,
  },
  grandTotalLabel: {
    fontSize: 14,
    fontFamily: 'Helvetica-Bold',
  },
  grandTotalValue: {
    fontSize: 14,
    fontFamily: 'Helvetica-Bold',
    color: '#2C5F8A',
  },
  termsTitle: {
    fontSize: 11,
    fontFamily: 'Helvetica-Bold',
    color: '#2C5F8A',
    marginTop: 25,
    marginBottom: 8,
  },
  termsText: {
    fontSize: 8,
    color: '#666',
    lineHeight: 1.5,
  },
  footer: {
    position: 'absolute',
    bottom: 30,
    left: 50,
    right: 50,
    textAlign: 'center',
    fontSize: 8,
    color: '#999',
  },
});

function formatCurrency(amount) {
  return '$' + Number(amount || 0).toLocaleString('en-NZ', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function QuotePDF({ quote, client, settings }) {
  const gstRate = parseFloat(settings.gst_rate || '0.15');
  const totalExGst = quote.total_price || 0;
  const gstAmount = Math.round(totalExGst * gstRate * 100) / 100;
  const totalIncGst = Math.round((totalExGst + gstAmount) * 100) / 100;

  const companyName = settings.company_name || 'Devlin Property';
  const companyPhone = settings.company_phone || '';
  const companyEmail = settings.company_email || '';
  const terms = settings.terms_and_conditions || '';

  return React.createElement(Document, null,
    React.createElement(Page, { size: 'A4', style: pdfStyles.page },
      // Header
      React.createElement(View, { style: pdfStyles.headerRow },
        React.createElement(Image, { src: LOGO_PATH, style: pdfStyles.logo }),
        React.createElement(View, { style: pdfStyles.companyInfo },
          React.createElement(Text, { style: pdfStyles.companyName }, companyName),
          companyPhone && React.createElement(Text, null, companyPhone),
          companyEmail && React.createElement(Text, null, companyEmail),
        ),
      ),

      // Title
      React.createElement(Text, { style: pdfStyles.quoteTitle }, 'QUOTATION'),

      // Quote meta
      React.createElement(View, { style: pdfStyles.metaRow },
        React.createElement(Text, { style: pdfStyles.metaLabel }, 'Quote No:'),
        React.createElement(Text, { style: pdfStyles.metaValue }, quote.quote_number),
      ),
      React.createElement(View, { style: pdfStyles.metaRow },
        React.createElement(Text, { style: pdfStyles.metaLabel }, 'Date:'),
        React.createElement(Text, { style: pdfStyles.metaValue },
          new Date(quote.created_at).toLocaleDateString('en-NZ', { day: 'numeric', month: 'long', year: 'numeric' }),
        ),
      ),
      React.createElement(View, { style: pdfStyles.metaRow },
        React.createElement(Text, { style: pdfStyles.metaLabel }, 'Valid Until:'),
        React.createElement(Text, { style: pdfStyles.metaValue },
          quote.valid_until
            ? new Date(quote.valid_until + 'T00:00:00').toLocaleDateString('en-NZ', { day: 'numeric', month: 'long', year: 'numeric' })
            : 'N/A',
        ),
      ),

      // Client
      client && React.createElement(View, null,
        React.createElement(Text, { style: pdfStyles.sectionTitle }, 'Prepared For'),
        React.createElement(View, { style: pdfStyles.clientBlock },
          React.createElement(Text, { style: pdfStyles.clientName }, client.name),
          client.company && React.createElement(Text, { style: pdfStyles.clientDetail }, client.company),
          client.address && React.createElement(Text, { style: pdfStyles.clientDetail }, client.address),
          client.email && React.createElement(Text, { style: pdfStyles.clientDetail }, client.email),
          client.phone && React.createElement(Text, { style: pdfStyles.clientDetail }, client.phone),
        ),
      ),

      // Project
      (quote.project_name || quote.project_address) && React.createElement(View, null,
        React.createElement(Text, { style: pdfStyles.sectionTitle }, 'Project'),
        quote.project_name && React.createElement(Text, null, quote.project_name),
        quote.project_address && React.createElement(Text, { style: pdfStyles.clientDetail }, quote.project_address),
      ),

      // Description
      React.createElement(Text, { style: pdfStyles.sectionTitle }, 'Description'),
      React.createElement(Text, null, 'DEVPRO Wall Panel System — Supply of materials for prefabricated wall panel construction.'),

      // Price box
      React.createElement(View, { style: pdfStyles.priceBox },
        React.createElement(View, { style: pdfStyles.priceRow },
          React.createElement(Text, { style: pdfStyles.priceLabel }, 'Total (excl. GST)'),
          React.createElement(Text, { style: pdfStyles.priceValue }, formatCurrency(totalExGst)),
        ),
        React.createElement(View, { style: pdfStyles.priceRow },
          React.createElement(Text, { style: pdfStyles.priceLabel }, `GST (${(gstRate * 100).toFixed(0)}%)`),
          React.createElement(Text, { style: pdfStyles.priceValue }, formatCurrency(gstAmount)),
        ),
        React.createElement(View, { style: pdfStyles.totalDivider }),
        React.createElement(View, { style: pdfStyles.priceRow },
          React.createElement(Text, { style: pdfStyles.grandTotalLabel }, 'Total (incl. GST)'),
          React.createElement(Text, { style: pdfStyles.grandTotalValue }, formatCurrency(totalIncGst)),
        ),
      ),

      // Terms
      terms && React.createElement(View, null,
        React.createElement(Text, { style: pdfStyles.termsTitle }, 'Terms & Conditions'),
        React.createElement(Text, { style: pdfStyles.termsText }, terms),
      ),

      // Footer
      React.createElement(Text, { style: pdfStyles.footer },
        `${companyName} — ${quote.quote_number}`,
      ),
    ),
  );
}

export async function generateQuotePdf(quote, client, settings) {
  const settingsMap = {};
  for (const s of settings) {
    settingsMap[s.key] = s.value;
  }

  const element = React.createElement(QuotePDF, { quote, client, settings: settingsMap });
  const buffer = await renderToBuffer(element);
  return buffer;
}
