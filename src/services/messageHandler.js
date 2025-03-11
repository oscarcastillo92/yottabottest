import whatsappService from './whatsappService.js';
import appendToSheet from './googleSheetsServices.js';
import openAiService from './openAiService.js';

class MessageHandler {

  constructor() {
    this.appointmentState = {};
    this.assistantState = {};
   }
  async handleIncomingMessage(message, senderInfo) {
    if (message?.type === 'text') {
      const incomingMessage = message.text.body.toLowerCase().trim();

      if (this.isGreeting(incomingMessage)) {
        await this.sendWelcomeMessage(message.from, message.id, senderInfo);
        await this.sendWelcomeMenu(message.from);
      } else if (['imagen', 'audio', 'video', 'documento'].includes(incomingMessage.toLowerCase())) {
        await this.sendMedia(message.from, incomingMessage.toLowerCase());
    } else if(this.appointmentState[message.from]) {
      await this.handleAppoinmentFlow(message.from, incomingMessage);
    } else if(this.assistantState[message.from]) {
      await this.handleAssistantFlow(message.from, incomingMessage);
    } else {
        const response = `Echo: ${message.text.body}`;
        await whatsappService.sendMessage(message.from, response, message.id);
      }
 
      await whatsappService.markAsRead(message.id);
    } else if (message?.type === 'interactive') {
      const optionId = message?.interactive?.button_reply?.id;
      await this.handleMenuOption(message.from, optionId);

      await whatsappService.markAsRead(message.id);
    }
  }

  isGreeting(message) {
    const greetings = ["hola", "hi", "hey", "buenas tardes", "buenos días"];
    return greetings.includes(message);
  }

  getSenderName(senderInfo) {
    const fullName = senderInfo.profile?.name || senderInfo.wa_id || " ";
    return fullName.split(" ")[0]; // Toma solo la primera palabra del nombre
  }

async sendWelcomeMessage(to, messageId, senderInfo) {
    const name = this.getSenderName(senderInfo);
    const welcomeMessage = `Hola ${name}, bienvenido a la agencia de Web y SEO Yotta ` + 
    `¿Cómo puedo ayudarte hoy?`;
    await whatsappService.sendMessage(to, welcomeMessage, messageId);
}

  async sendWelcomeMenu(to){
    const menuMessage = "Selecciona una de las siguientes opciones:"
    const buttons = [
      {
        type: "reply", reply: {id: "opcion_1", title: "Consulta con IA"}
      },
      {
        type: "reply", reply: {id: "opcion_2", title: "Programar Consulta"}
      },
      {
        type: "reply", reply: {id: "opcion_3", title: "Ver su sitio web"}
      },
    ];

    await whatsappService.sendInteractiveButtons(to, menuMessage, buttons);

  }

  async handleMenuOption(to, option) {
    let response;
    switch (option) {
      case "opcion_1":
        this.assistantState[to] = { step: 'question' };
        response = "Realiza tu consulta";
        break;
      case "opcion_2":
        this.appointmentState[to] = { step: 'name' };
        response = '¿Cual es tu nombre?';
        break;
      case "opcion_3":
        await whatsappService.sendMessage(to, "Visita nuestro sitio web aquí https://agenciayotta.com");
        break;
      case "opcion_4": // Si responde "Si, gracias", inicia el flujo de agendamiento
        this.appointmentState[to] = { step: 'name' };
        response = '¡Genial! Para agendar un servicio, ¿cuál es tu nombre?';
        delete this.assistantState[to]; // Eliminar estado del asistente
        break;
      case "opcion_5": // Si responde "Otra consulta", vuelve a iniciar el asistente
        delete this.assistantState[to];
        this.assistantState[to] = { step: 'question' };
        response = "Realiza tu nueva consulta";
        break;
      default:
        await whatsappService.sendMessage(to, "Opción no válida");
        break;
    }
    await whatsappService.sendMessage(to, response);
  }

  async sendMedia(to, mediaType) {
    let mediaUrl, caption, validMediaType;

    // Normaliza el input del usuario a minúsculas
    switch (mediaType.toLowerCase()) {
        case "imagen":
            validMediaType = "image";
            mediaUrl = "https://agenciayotta.com/wp-content/uploads/2024/10/Logo-JPG-1024x1024.jpg";
            caption = "¡Logo de Yotta!";
            break;

        case "audio":
            validMediaType = "audio";
            mediaUrl = "https://s3.amazonaws.com/gndx.dev/medpet-audio.aac";
            caption = "Bienvenida";
            break;

        case "video":
            validMediaType = "video";
            mediaUrl = "https://s3.amazonaws.com/gndx.dev/medpet-video.mp4";
            caption = "¡Esto es un video!";
            break;

        case "documento":
            validMediaType = "document";
            mediaUrl = "https://s3.amazonaws.com/gndx.dev/medpet-file.pdf";
            caption = "¡Esto es un PDF!";
            break;

        default:
            await whatsappService.sendMessage(to, "No es un tipo de archivo multimedia válido.");
            return;
    }

    // Envía el mensaje multimedia
    await whatsappService.sendMediaMessage(to, validMediaType, mediaUrl, caption);
}


completeAppointment(to) {
  const appointment = this.appointmentState[to];
  delete this.appointmentState[to];

  const userData = [
    to,
    appointment.name,
    appointment.ciudad,
    appointment.service,
    appointment.date,
    appointment.phone,
    new Date().toISOString()
  ]

  appendToSheet(userData);

  return `Gracias por agendar tu cita. 
  Resumen de tu cita:
  
  Nombre: ${appointment.name}
  Servicio de tu interes: ${appointment.service}
  Télefono: ${appointment.phone}
  fecha: ${appointment.date}
  
  Nos pondremos en contacto contigo pronto para confirmar la fecha y hora de tu cita.`
}

  async handleAppoinmentFlow(to, message) {
    const state = this.appointmentState[to];
    let response;

    switch (state.step) {
      case 'name':
        state.name = message;
        state.step = 'ciudad';
        response = '¿De que ciudad nos contactas?';
        break;

      case 'ciudad':
        state.ciudad = message;
        state.step = 'service';
        response = '¿En que servicio te encuentras interesado (Desarrollo web, SEO o ChatBots)?';
        break;


      case 'service':
        state.service = message;
        state.step = 'date';
        response = '¿En que fecha tienes disponibilidad para ser contactado?';
        break;

      case 'date':
        state.date = message;
        state.step = 'phone';
        response = '¿Cual es tu telefono?';
        break;

      case 'phone':
        state.phone = message;
        response = this.completeAppointment(to);
        break;
    }

    await whatsappService.sendMessage(to, response);
  }

async handleAssistantFlow(to, message) {
  const state = this.assistantState[to];
  let response;

  if (state.step === 'question') {
    response = await openAiService(message);
  }

  const menuMessage = "¿Hemos resuelto tu duda?"
  const buttons = [
    {
      type: "reply",
      reply: {
        id: "opcion_4",
        title: "Si, gracias",
      },
    },
    {
      type: "reply",
      reply: {
        id: "opcion_5",
        title: "Otra consulta",
      },
    },
  ]

  await whatsappService.sendMessage(to, response);
  await whatsappService.sendInteractiveButtons(to, menuMessage, buttons);

}


}

export default new MessageHandler();