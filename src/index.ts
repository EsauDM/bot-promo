import { connectToWhatsApp } from './whatsapp/connection';
import { getDb } from './database/db';

async function bootstrap() {
    console.log('🔄 Inicializando banco de dados...');
    await getDb();
    
    console.log('🚀 Iniciando Bot do WhatsApp...');
    await connectToWhatsApp();
}

// Tratar possíveis rejeições de promessas não capturadas para o bot não morrer
process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

bootstrap().catch(console.error);
