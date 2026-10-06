import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Get current directory
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Supabase configuration
const supabaseUrl = 'https://lqdypekghpkbtdstqvju.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxxZHlwZWtnaHBrYnRkc3Rxdmp1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODI2NTIxNzgsImV4cCI6MjA5ODIyODE3OH0.CURATlvOaB6Ourr_ymso9mOKDXuE7KlLKhvgzMJ-gT0';

const supabase = createClient(supabaseUrl, supabaseKey);

// YOUR BRANCH ID
const BRANCH_ID = '8b2e9fdb-5337-4aa1-81f2-63d23af7dbbc';

// Create a logs directory for printing
const logsDir = path.join(__dirname, 'print_logs');
if (!fs.existsSync(logsDir)) {
    fs.mkdirSync(logsDir);
}

async function processPrintJobs() {
    try {
        console.log('🔍 Checking for pending jobs...');
        
        // Fetch pending jobs for this branch
        const { data: jobs, error } = await supabase
            .from('print_jobs')
            .select('*')
            .eq('branch_id', BRANCH_ID)
            .eq('status', 'pending')
            .order('created_at', { ascending: true })
            .limit(1);

        if (error) {
            console.error('❌ Error fetching jobs:', error.message);
            return;
        }

        if (!jobs || jobs.length === 0) {
            // Silent mode - no jobs
            return;
        }

        const job = jobs[0];
        console.log(`📋 Processing job: ${job.id}`);
        console.log(`   Type: ${job.payload?.job_type || 'unknown'}`);
        console.log(`   Created: ${job.created_at}`);
        console.log(`   Full payload:`, JSON.stringify(job.payload, null, 2));

        // Step 1: Claim the job (mark as processing)
        const { error: claimError } = await supabase
            .from('print_jobs')
            .update({
                status: 'processing',
                claimed_at: new Date().toISOString()
            })
            .eq('id', job.id);

        if (claimError) {
            console.error('❌ Error claiming job:', claimError.message);
            return;
        }

        console.log('✅ Job claimed');

        // Step 2: "Print" to PDF (simulate printing)
        const receiptData = job.payload;
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const filename = `receipt_${job.id.substring(0,8)}_${timestamp}.txt`;
        const filepath = path.join(logsDir, filename);

        // Create a text representation of the receipt
        let receiptContent = '='.repeat(50) + '\n';
        receiptContent += '          PRINT JOB RECEIPT\n';
        receiptContent += '='.repeat(50) + '\n\n';
        receiptContent += `Job ID: ${job.id}\n`;
        receiptContent += `Branch ID: ${job.branch_id}\n`;
        receiptContent += `Job Type: ${receiptData?.job_type || 'pos_receipt'}\n`;
        receiptContent += `Created: ${job.created_at}\n`;
        receiptContent += `Printed: ${new Date().toISOString()}\n\n`;
        receiptContent += '-'.repeat(50) + '\n\n';
        
        if (receiptData?.items && Array.isArray(receiptData.items)) {
            receiptContent += 'ITEMS:\n';
            receiptContent += '-'.repeat(50) + '\n';
            receiptData.items.forEach((item, index) => {
                receiptContent += `${index + 1}. ${item.name || 'Item'}\n`;
                receiptContent += `   Qty: ${item.quantity || 1}\n`;
                receiptContent += `   Price: $${(item.price || 0).toFixed(2)}\n`;
                receiptContent += `   Total: $${(item.total || 0).toFixed(2)}\n\n`;
            });
        } else {
            receiptContent += 'No items found in payload\n';
            receiptContent += `Raw payload: ${JSON.stringify(receiptData, null, 2)}\n`;
        }
        
        receiptContent += '-'.repeat(50) + '\n';
        receiptContent += `Subtotal: $${(receiptData?.subtotal || 0).toFixed(2)}\n`;
        receiptContent += `Discount: $${(receiptData?.discount || 0).toFixed(2)}\n`;
        receiptContent += `Tax: $${(receiptData?.tax || 0).toFixed(2)}\n`;
        receiptContent += `Total: $${(receiptData?.total || 0).toFixed(2)}\n`;
        receiptContent += `Payment: ${receiptData?.payment_method || 'cash'}\n`;
        if (receiptData?.cash_received) {
            receiptContent += `Cash Received: $${(receiptData.cash_received || 0).toFixed(2)}\n`;
            receiptContent += `Change Return: $${(receiptData.change_return || 0).toFixed(2)}\n`;
        }
        receiptContent += '\n' + '='.repeat(50) + '\n';
        receiptContent += '     ✅ PRINTED TO PDF (TEST MODE)\n';
        receiptContent += '='.repeat(50) + '\n';

        // Write to file (simulating printing to PDF)
        fs.writeFileSync(filepath, receiptContent);
        console.log(`📄 Receipt saved to: ${filepath}`);

        // Wait a moment to simulate printing time
        await new Promise(resolve => setTimeout(resolve, 1500));

        // Step 3: Mark as completed
        const { error: completeError } = await supabase
            .from('print_jobs')
            .update({
                status: 'completed',
                completed_at: new Date().toISOString()
            })
            .eq('id', job.id);

        if (completeError) {
            console.error('❌ Error completing job:', completeError.message);
            await supabase
                .from('print_jobs')
                .update({
                    status: 'failed',
                    error_message: completeError.message
                })
                .eq('id', job.id);
            return;
        }

        console.log('✅ Job completed successfully!');
        console.log('📊 Status: pending → processing → completed');
        console.log('='.repeat(50) + '\n');

    } catch (error) {
        console.error('❌ Error processing job:', error.message);
        console.error(error.stack);
    }
}

// Poll for jobs every 5 seconds
console.log('🖨️  Printer Agent Starting...');
console.log(`📂 Print logs will be saved to: ${logsDir}`);
console.log(`🏪 Monitoring branch: ${BRANCH_ID}`);
console.log('⏰ Checking for jobs every 5 seconds...');
console.log('='.repeat(50));

// Run immediately on start
processPrintJobs();

// Then poll every 5 seconds
setInterval(processPrintJobs, 5000);

// Handle graceful shutdown
process.on('SIGINT', () => {
    console.log('\n\n👋 Printer agent stopped');
    process.exit(0);
});