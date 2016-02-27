use theeye_invap;
db.users.insert({'customer_id': 'gandalf', 'client_id': '1111', 'client_secret': 'G4nd4lf_Th3_Gr4y'});


// update a user
// must include old document fields and updates
db.user.update({ "_id" : ObjectId("54d2f78d13440af624f035ea")},{ "_id" : ObjectId("54d2f78d13440af624f035ea"), "username" : "invapadmin", "email" : "ARodriguez@invap.com.ar", "customers" : ["invap"], "createdAt" : ISODate("2015-02-05T04:54:37.961Z"), "updatedAt" : ISODate("2015-02-05T04:54:37.961Z") });









db.users.find({ client_id : { $exists: true } }, { client_id : 1, client_secret : 1 });
db.users.insert({ "customer_name" : "theeye", "customer_id" : "", "token" : "xvkdycTbhS0lIMBe+osRR+GKODk=", "client_secret" :"esto es secreto" , "client_id" :  "theeye" })
db.users.update({ _id:ObjectId("563ba2f3f0e4b25b4b2b21da") },{ $set: {"enabled":true} } );
db.users.update({ _id:ObjectId("557ec3e981a2334537425ec5") },{ $set: {"client_secret":"V14p00lV14p00lV14p00lV14p00l", "client_id":"viapool"} } );
db.users.update({ client_id : { $exists: true } }, { $set: { "credential": "agent" } }, { multi:true });

db.users.find({ "username" : { $exists: true } }).forEach( function(x){ db.web_user.insert(x) } )


db.customers.find().forEach(function(c){
  db.user_test.update(
    {customer_name: c.name },
    { $set: { customers: [{ _id: c._id.valueOf(), customer: c._id, name: c.name  }] }  }
  );
});
