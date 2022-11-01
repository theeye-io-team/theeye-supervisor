MONITOR 


* file
* script
* scraper / web check
* process
* dstat / host stats
* psaux / process list

los monitores pueden estar en uno de los siguientes estados

* normal (el chequeo es success)
* failure (fallo el chequeo)
* updates_stopped (dejo de reportar)
* error (NOTA: eventualmente puede aparecer este estado, pero solo si ocurre algo inesperado o si falla el agente)

el monitor pasa de un estado a otro, y siempre esta en uno de esos.

NOTA: solo cuando esta iniciando puede estar en estado `unknown`

asociado a esos estados esta el evento que dispara según que haya pasado.
los eventos los determina el supervisor en base al cambio de estado.
pero si el agente emite un evento además del cambio de estado, el supervisor usa el que recibio del agente.
el evento se produce solo cuando el monitor cambia de estado

basic events - all monitor

* recovered (de failure a normal)
* failure (de normal o updates_stopped a failure)
* updates_stopped (de normal o failure a updates_stopped)
* updates_started (de updates_stopped a normal)

file

* file:restored (el archivo fue restaurado luego haber sufrido un cambio o de haberse creado)
* file:error:access (el agente no puede ver el archivo o no lo puede crear)
* file:error:perm (no tiene los permisos adecuados o no los puede cambiar)
* file:error:unknown (hubo un error pero no puede determinar cual o no fue tenido en cuenta)

host stats (estos son obvios)

* host:stats:cpu:high
* host:stats:mem:high
* host:stats:disk:high
* host:stats:cache:high
* host:stats:normal

scraper - http request

* scraper:error
* scraper:error:request (fallo el envío del req por un error)
* scraper:config:status_code:invalid_regexp (la exp regular fue mal configurada. esto no debería pasar porque el supervisor y la interfaz lo validan. pero no esta de mas)
* scraper:config:pattern:invalid_regexp (la exp regular fue mal configurada. esto no debería pasar porque el supervisor y la interfaz lo validan. pero no esta de mas)
* scraper:mismatch:status_code (no se encontró el status code esperado)
* scraper:mismatch:pattern (el patrón de búsqueda no esta en la respuesta)


los monitores de processes y script de momento no disparan eventos particulares

ninguno de los eventos particulares se estan handleando excepto los del monitor de stats de host, que se usan para el envío de los mails.

==============================================================================

job / task execution

* script
* scraper / web check
* agent update

....
