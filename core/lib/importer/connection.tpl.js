/*******************************************************
 *
 * Agents Connection Template
 *
 * name            : nombre del agente
 * customer_id     : nombre del usuario
 * customer_secret : contraseña del usuario
 * host_id         : id externo del host desde donde se conecta el agente
 *
 * "Mismo supervisor para todos los agentes"
 * El resto de los datos corresponden al supervisor.
 *
 * auth        : url donde llevar a cabo la autenticacion basica para obtener el token digest
 * data_submit : url y puert donde se realiza la comunicacion luego de autenticar
 *
 *******************************************************/

var ConnectionTemplate = {
    client_id : [],
    client_secret : [],
    customer_id : '', 
    customer_name : '', 
    host_id : '', 
    data_submit : { 
        url:'http://supervisor.theeye.io',
        port:'80',
        version:'*' 
    },  
    auth : { 
        url:'http://auth.theeye.io',
        port:'80',
        controller:'/:customer/token', // replace with the customer name
        version:'*'
    }   
};

module.exports = ConnectionTemplate ;

/*******************************************************/
