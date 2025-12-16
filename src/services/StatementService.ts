import Decimal from 'decimal.js';
import { createObjectCsvStringifier } from 'csv-writer';
import PDFDocument from 'pdfkit';
import { StatementOptions, StatementEntry, EntryType, TransactionStatus } from '../types';
import { accountService } from './AccountService';
import { transactionService } from './TransactionService';

export class StatementService {
  async generateStatement(options: StatementOptions): Promise<{ data: Buffer; mimeType: string; filename: string }> {
    const account = await accountService.getAccount(options.accountId);
    if (!account) {
      throw new Error(`Account not found: ${options.accountId}`);
    }
    
    const entries = await transactionService.getEntriesByAccount(options.accountId, {
      startDate: options.startDate,
      endDate: options.endDate,
      status: TransactionStatus.POSTED,
    });
    
    const openingBalance = await accountService.getAccountBalance(
      options.accountId,
      new Date(options.startDate.getTime() - 86400000)
    );
    
    const statementEntries: StatementEntry[] = [];
    let runningBalance = openingBalance;
    
    for (const entry of entries) {
      const transaction = await transactionService.getTransaction(entry.transactionId);
      if (!transaction) continue;
      
      let debit: Decimal | null = null;
      let credit: Decimal | null = null;
      
      if (entry.entryType === EntryType.DEBIT) {
        debit = entry.amount;
        if (account.normalBalance === EntryType.DEBIT) {
          runningBalance = runningBalance.plus(entry.amount);
        } else {
          runningBalance = runningBalance.minus(entry.amount);
        }
      } else {
        credit = entry.amount;
        if (account.normalBalance === EntryType.CREDIT) {
          runningBalance = runningBalance.plus(entry.amount);
        } else {
          runningBalance = runningBalance.minus(entry.amount);
        }
      }
      
      statementEntries.push({
        date: transaction.transactionDate,
        reference: transaction.reference,
        description: entry.description || transaction.description,
        debit,
        credit,
        balance: runningBalance,
        currencyCode: entry.currencyCode,
      });
    }
    
    if (options.format === 'CSV') {
      return this.generateCSV(account, statementEntries, openingBalance, options);
    } else {
      return this.generatePDF(account, statementEntries, openingBalance, options);
    }
  }

  private async generateCSV(
    account: { code: string; name: string; currencyCode: string },
    entries: StatementEntry[],
    openingBalance: Decimal,
    options: StatementOptions
  ): Promise<{ data: Buffer; mimeType: string; filename: string }> {
    const csvStringifier = createObjectCsvStringifier({
      header: [
        { id: 'date', title: 'Date' },
        { id: 'reference', title: 'Reference' },
        { id: 'description', title: 'Description' },
        { id: 'debit', title: 'Debit' },
        { id: 'credit', title: 'Credit' },
        { id: 'balance', title: 'Balance' },
        { id: 'currency', title: 'Currency' },
      ],
    });
    
    const records = [
      {
        date: options.startDate.toISOString().split('T')[0],
        reference: '',
        description: 'Opening Balance',
        debit: '',
        credit: '',
        balance: openingBalance.toFixed(2),
        currency: account.currencyCode,
      },
      ...entries.map(entry => ({
        date: entry.date instanceof Date ? entry.date.toISOString().split('T')[0] : entry.date,
        reference: entry.reference,
        description: entry.description,
        debit: entry.debit ? entry.debit.toFixed(2) : '',
        credit: entry.credit ? entry.credit.toFixed(2) : '',
        balance: entry.balance.toFixed(2),
        currency: entry.currencyCode,
      })),
    ];
    
    const header = csvStringifier.getHeaderString();
    const body = csvStringifier.stringifyRecords(records);
    const csv = `Account: ${account.code} - ${account.name}\nPeriod: ${options.startDate.toISOString().split('T')[0]} to ${options.endDate.toISOString().split('T')[0]}\n\n${header}${body}`;
    
    const filename = `statement_${account.code}_${options.startDate.toISOString().split('T')[0]}_${options.endDate.toISOString().split('T')[0]}.csv`;
    
    return {
      data: Buffer.from(csv, 'utf-8'),
      mimeType: 'text/csv',
      filename,
    };
  }

  private async generatePDF(
    account: { code: string; name: string; currencyCode: string },
    entries: StatementEntry[],
    openingBalance: Decimal,
    options: StatementOptions
  ): Promise<{ data: Buffer; mimeType: string; filename: string }> {
    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({ margin: 50 });
      const chunks: Buffer[] = [];
      
      doc.on('data', (chunk: Buffer) => chunks.push(chunk));
      doc.on('end', () => {
        const data = Buffer.concat(chunks);
        const filename = `statement_${account.code}_${options.startDate.toISOString().split('T')[0]}_${options.endDate.toISOString().split('T')[0]}.pdf`;
        resolve({
          data,
          mimeType: 'application/pdf',
          filename,
        });
      });
      doc.on('error', reject);
      
      doc.fontSize(20).text('Account Statement', { align: 'center' });
      doc.moveDown();
      
      doc.fontSize(12);
      doc.text(`Account: ${account.code} - ${account.name}`);
      doc.text(`Currency: ${account.currencyCode}`);
      doc.text(`Period: ${options.startDate.toISOString().split('T')[0]} to ${options.endDate.toISOString().split('T')[0]}`);
      doc.moveDown();
      
      const tableTop = doc.y;
      const colWidths = [80, 80, 150, 70, 70, 70];
      const headers = ['Date', 'Reference', 'Description', 'Debit', 'Credit', 'Balance'];
      
      let x = 50;
      doc.font('Helvetica-Bold');
      headers.forEach((header, i) => {
        doc.text(header, x, tableTop, { width: colWidths[i], align: 'left' });
        x += colWidths[i];
      });
      
      doc.font('Helvetica');
      let y = tableTop + 20;
      
      x = 50;
      doc.text(options.startDate.toISOString().split('T')[0], x, y, { width: colWidths[0] });
      x += colWidths[0];
      doc.text('', x, y, { width: colWidths[1] });
      x += colWidths[1];
      doc.text('Opening Balance', x, y, { width: colWidths[2] });
      x += colWidths[2];
      doc.text('', x, y, { width: colWidths[3] });
      x += colWidths[3];
      doc.text('', x, y, { width: colWidths[4] });
      x += colWidths[4];
      doc.text(openingBalance.toFixed(2), x, y, { width: colWidths[5] });
      y += 15;
      
      for (const entry of entries) {
        if (y > 700) {
          doc.addPage();
          y = 50;
        }
        
        x = 50;
        const dateStr = entry.date instanceof Date ? entry.date.toISOString().split('T')[0] : String(entry.date);
        doc.text(dateStr, x, y, { width: colWidths[0] });
        x += colWidths[0];
        doc.text(entry.reference.substring(0, 12), x, y, { width: colWidths[1] });
        x += colWidths[1];
        doc.text(entry.description.substring(0, 25), x, y, { width: colWidths[2] });
        x += colWidths[2];
        doc.text(entry.debit ? entry.debit.toFixed(2) : '', x, y, { width: colWidths[3] });
        x += colWidths[3];
        doc.text(entry.credit ? entry.credit.toFixed(2) : '', x, y, { width: colWidths[4] });
        x += colWidths[4];
        doc.text(entry.balance.toFixed(2), x, y, { width: colWidths[5] });
        y += 15;
      }
      
      doc.moveDown(2);
      const closingBalance = entries.length > 0 ? entries[entries.length - 1].balance : openingBalance;
      doc.font('Helvetica-Bold').text(`Closing Balance: ${closingBalance.toFixed(2)} ${account.currencyCode}`);
      
      doc.end();
    });
  }

  async getAccountSummary(
    accountId: string,
    startDate: Date,
    endDate: Date
  ): Promise<{
    openingBalance: Decimal;
    closingBalance: Decimal;
    totalDebits: Decimal;
    totalCredits: Decimal;
    netChange: Decimal;
    transactionCount: number;
  }> {
    const account = await accountService.getAccount(accountId);
    if (!account) {
      throw new Error(`Account not found: ${accountId}`);
    }
    
    const openingBalance = await accountService.getAccountBalance(
      accountId,
      new Date(startDate.getTime() - 86400000)
    );
    
    const closingBalance = await accountService.getAccountBalance(accountId, endDate);
    
    const entries = await transactionService.getEntriesByAccount(accountId, {
      startDate,
      endDate,
      status: TransactionStatus.POSTED,
    });
    
    let totalDebits = new Decimal(0);
    let totalCredits = new Decimal(0);
    const transactionIds = new Set<string>();
    
    for (const entry of entries) {
      transactionIds.add(entry.transactionId);
      if (entry.entryType === EntryType.DEBIT) {
        totalDebits = totalDebits.plus(entry.amount);
      } else {
        totalCredits = totalCredits.plus(entry.amount);
      }
    }
    
    return {
      openingBalance,
      closingBalance,
      totalDebits,
      totalCredits,
      netChange: closingBalance.minus(openingBalance),
      transactionCount: transactionIds.size,
    };
  }
}

export const statementService = new StatementService();
