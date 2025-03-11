import sendToWhatsApp from "./httpRequest/sendToWhatsapp.js";

class WhatsAppService {
  async sendMessage(to, body, messageId = null) {
    try {
        const data = {
            messaging_product: 'whatsapp',
            to,
            text: { body },
            ...(messageId && { context: { message_id: messageId } }) // Agregar contexto solo si messageId existe
        };

        await sendToWhatsApp(data);
    } catch (error) {
        console.error('Error sending message:', error.response?.data || error);
    }
}

async markAsRead(messageId) {
  try {
      const data = {
          messaging_product: 'whatsapp',
          status: 'read',
          message_id: messageId,
      };

      await sendToWhatsApp(data);
  } catch (error) {
      console.error('Error marking message as read:', error.response?.data || error);
  }
}

async sendInteractiveButtons(to, BodyText, buttons) {
  try {
      const data = {
          messaging_product: 'whatsapp',
          to,
          type: 'interactive',
          interactive: {
              type: 'button',
              body: { text: BodyText },
              action: { buttons }
          }
      };

      await sendToWhatsApp(data);
  } catch (error) {
      console.error('Error sending interactive buttons:', error.response?.data || error);
  }
}

async sendMediaMessage(to, type, mediaUrl, caption) {
  try {
      const mediaObject = {
          image: type === 'image' ? { link: mediaUrl, caption } : undefined,
          audio: type === 'audio' ? { link: mediaUrl } : undefined,
          video: type === 'video' ? { link: mediaUrl, caption } : undefined,
          document: type === 'document' ? { link: mediaUrl, caption, filename: 'AgenciaYotta.pdf' } : undefined
      };

      const data = {
          messaging_product: 'whatsapp',
          to,
          type,
          ...Object.fromEntries(Object.entries(mediaObject).filter(([_, v]) => v)) // Elimina propiedades undefined
      };

      await sendToWhatsApp(data);
  } catch (error) {
      console.error('Error sending media:', error);
  }
}
}

export default new WhatsAppService();