[![theeye.io](images/logo-theeye-theOeye-logo2.png)](https://theeye.io/en/index.html)

# Integraión mediante la API

## Acceder a la API

Se puede acceder a la API de distintas maneras:

* [Autenticación básica](#autenticación-básica)
* [Tokens al portador (Bearer Authentication)](#autenticación-al-portador-bearer-authentication)
* [Recursos con clave secreta propia](#recursos-con-clave-secreta-propia)
* [Tokens de integración (Integration Tokens)](#tokens-de-integración-integration-tokens)

-----

### Authenticación básica

Se puede hacer un request al endpoint de inicio de sesión de la API usando el protocolo de autenticación básica HTTP. Como la API de TheEye se comunica con el cliente por HTTPS, se recomienda enviar un POST request de autenticación a la siguiente dirección, reemplazando `${usuario}` y `${contraseña}` acorde:

```javascript
`https://${usuario}:${contraseña}@app.theeye.io/api/auth/login`
```

Este request devuelve un `access_token`, el cual es una string codificada de [JWT](https://jwt.io), la cual contiene el ID del ususario, la fecha de creación y de caducidad del Token. Este token se requiere para la mayoría de las operaciones de la API, y se tiene que enviar con los requests como se explica en la siguiente sección

### Autenticación al portador (Bearer Authentication)

Una vez que haya recibido su `access_token`, será necesario incluirlo en sus requests como el Bearer Token para indicarle a la API el usuario del que proviene.

Los tokens de acceso obtenidos mediante autenticación básica son válidos durante 3 horas

### Recursos con clave secreta propia

Algunos recursos de la API de TheEye tienen una clave secreta propia, independiente de la autenticación de usuario. Por ejemplo, se pueden ejecutar tareas sabiendo su ID y su clave secreta. [Más información](es/tasks/#usando-la-secret-key-de-la-tarea-recomendado)

### Tokens de integración (Integration Tokens)

Los tokens de integración permiten acceder a la API. Son secuencias de caracteres auto-generadas utilizando la librería JWT (JSON Web Token).

Los tokens de integración son tokens de acceso (access token) que, a diferencia de los tokens de acceso de sesión generados mediante autenticación básica, no tienen tiempo de expiración y pueden ser utilizados indefinidamente o hasta que un administrador lo elimine del sistema.
Es conveniente tener bien identificado donde serán utilizados y renovarlos periódicamente.


Para revisar si se encuentra tokens de integración activos:

- Inicie sesión en la consola de administración de TheEye **con una cuenta de ADMINISTRADOR**

- En la página principal, diríjase a *Settings* y seleccione *credentials*. Allí se puede acceder a *Integration Tokens* donde se podrá ver los tokens de integración creados

![dashboard_settings_credentials](images/dashboard_setting_credentials.png)

