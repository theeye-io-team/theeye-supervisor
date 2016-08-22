Install postfix.

You need to add in `/etc/postfix/main.cf` :

```
transport_maps = hash:/etc/postfix/transport
luser_relay = local_user
```

Replace `local_user` with the user which will receive every redirected email

Then create `/etc/postfix/transport` with this in there:

```
localhost :
* local:local_user
```

Save an then run:

`postmap /etc/postfix/transport`

Finally restart postfix 

`sudo service postfix restart`

