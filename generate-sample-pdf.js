const fs = require('fs');
const path = require('path');
const { generateInvoiceHTML, generateInvoicePDF } = require('./services/emailNotificationService');

async function generateSample() {
    const sampleOrderData = {
        order: {
            _id: 'test123',
            orderNumber: 'SBF-2024-001',
            totalAmount: 1449,
            currency: 'INR',
            createdAt: new Date('2024-03-07T10:00:00Z'),
            subtotal: 1299,
            deliveryFee: 200,
            promoCode: {
                code: 'WELCOME50',
                discount: 50
            },
            shippingDetails: {
                fullName: 'Test Customer',
                address: '123 Test Street',
                apartment: 'Apt 4B',
                city: 'Hyderabad',
                state: 'Telangana',
                zipCode: '500001',
                phone: '+919876543210',
                deliveryDate: new Date('2024-03-08T10:00:00Z'),
                timeSlot: '10:00 AM - 2:00 PM',
                deliveryOption: 'gift',
                receiverFirstName: 'Jane',
                receiverLastName: 'Doe',
                receiverPhone: '+919998887776',
                receiverAddress: '456 Gift Lane',
                receiverCity: 'Hyderabad',
                receiverState: 'Telangana',
                receiverZipCode: '500081',
                giftMessage: 'Happy Birthday! Hope you have a wonderful day.'
            },
            items: [
                {
                    product: { title: 'Beautiful Rose Bouquet' },
                    quantity: 1,
                    price: 799,
                    finalPrice: 699
                },
                {
                    product: { title: 'Premium Chocolate Box' },
                    quantity: 1,
                    price: 600,
                    finalPrice: 600
                }
            ],
            paymentDetails: {
                method: 'razorpay',
                paymentId: 'pay_test123',
                status: 'Completed'
            }
        },
        customer: {
            name: 'Test Customer',
            email: 'khushalprasad242@gmail.com',
            phone: '+919876543210'
        }
    };

    try {
        const html = generateInvoiceHTML(sampleOrderData);
        const pdfBuffer = await generateInvoicePDF(html, 'SBF-2024-001');
        const outPath = 'C:\\Users\\acer\\.gemini\\antigravity\\brain\\d76235b2-91fa-43c6-83f0-94ddd5960fe5\\sample_invoice.pdf';
        fs.writeFileSync(outPath, pdfBuffer);
        console.log('Sample PDF generated at:', outPath);
    } catch (err) {
        console.error('Error generating PDF:', err);
    }
}

generateSample();
