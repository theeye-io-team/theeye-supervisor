
global.APP_ROOT = __dirname + '/../../../core';
const debug = require('debug')('eye:deploy:task');
const mongodb = require( APP_ROOT + '/lib/mongodb' )
const config = require('config')
const isEmail = require('validator/lib/isEmail')

const main = async () => {
  let db
  try {

    db = await mongodb.connect(config.mongo)

    await migrate(db, 'tasks')
    await migrate(db, 'workflows')
    await migrate(db, 'resources')
    //await migrate(db, 'resourcemonitors')
    await migrate(db, 'indicators')


  } catch(err) {
    console.error(err)
  }

  db.close()

}

const migrate = async (db, collectionName) => {
  console.log(`migrating ${collectionName}`)
  const collection = await db.collection(collectionName)
  const cursor = collection.find({ "acl.1": { $exists: true } })

  while (await cursor.hasNext()) {
    const doc = await cursor.next()
    const acl = doc.acl

    if (Array.isArray(acl) && acl.length > 0) {
      const rebuildAcl = []
      for (const email of acl) {
        // acl es valida
        if (isEmail(email)) {
          const mailparts = email.split('@')
          const parts = mailparts[0].split('.')
          // sin formato nombre.apellido@domain
          if (parts.length > 1) {
            const nameA = ucFirst(parts[0])
            const nameB = ucFirst(parts[1])

            const rebuild = `${nameA}.${nameB}@${mailparts[1]}`
            rebuildAcl.push(rebuild)
          }
        }
      }

      if (rebuildAcl.length !== 0) {
        console.log('antes: ' + acl)
        console.log('despues: ' + rebuildAcl)
        await collection.updateOne({ _id: doc._id }, { $set: { acl: rebuildAcl } })
      }
    }
  }
}

const ucFirst = (string) => {
  return string.charAt(0).toUpperCase() + string.slice(1)
}

main()
