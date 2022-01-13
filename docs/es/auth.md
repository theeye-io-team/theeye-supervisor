[![theeye.io](images/logo-theeye-theOeye-logo2.png)](https://theeye.io/en/index.html)

# Integraión mediante la API

## Acceder a la API

Se puede acceder a la API de distintas maneras:

* [Identificadores de integración (Integration Tokens)](#identificadores-de-integración-integration-tokens)
* [Autenticación básica](#autenticación-básica)
* [Autenticación al portador (Bearer Authentication)](#autenticación-al-portador-bearer-authentication)
* [Recursos con identificador secreto propio](#recursos-con-identificador-secreto-propio)

-----

### Identificadores de integración (Integration Tokens)

Los identificadores de acceso son credenciales que se pueden usar para acceder a la API. Estos pueden ser una string simple o un JSON Web Token. Su trabajo es informar a la API que el portador del identificador fue autorizado para acceder a la API y disparar ciertas acciones que se definieron al crear el Token

Para revisar si se activó el acceso a la API:
- Inicie sesión en la consola de administración de TheEye **con una cuenta de ADMINISTRADOR**
- En la página principal, diríjase a *Settings* y seleccione *credentials*. Ahí se puede ver la lista *Integration Tokens* con los identificadores creados

![dashboard_settings_credentials](images/dashboard_setting_credentials.png)

### Authenticación básica

Se puede hacer un request al endpoint de inicio de sesión de la API usando el protocolo de autenticación básica HTTP. Como la API de TheEye se comunica con el cliente por HTTPS, se recomienda enviar un POST request de autenticación a la siguiente dirección, reemplazando `${usuario}` y `${contraseña}` acorde:

```javascript
`https://${usuario}:${contraseña}@app.theeye.io/api/auth/login`
```

Este request devuelve un `access_token`, el cual es una string codificada de [JWT](https://jwt.io), la cual contiene el ID del ususario, la fecha de creación y de caducidad del Token. Este token se requiere para la mayoría de las operaciones de la API, y se tiene que enviar con los requests como se explica en la siguiente sección

### Autenticación al portador (Bearer Authentication)

Una vez que haya recibido su `access_token`, será necesario incluirlo en sus requests como el Bearer Token para indicarle a la API el usuario del que proviene. Por favor tener en cuenta de que un token es válido por 3 horas 

### Recursos con identificador secreto propio

Algunos recursos de la API de TheEye tienen un identificador secreto propio, independiente de la autenticación de usuario. Por ejemplo, se pueden ejecutar tareas sabiendo su ID y su identificador secreto. [Más información](es/tasks/#usando-la-secret-key-de-la-tarea-recomendado)
