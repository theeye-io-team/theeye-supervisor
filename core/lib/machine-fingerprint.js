const config = require('config')
const { v5: uuidv5, v4: uuidv4 } = require('uuid')

const NAMESPACE = uuidv5(config.system.secret, config.system.secret_uuid)

module.exports = (machineData) => {
  const payload = []
  for (let name in machineData) {
    const part = machineData[name]
    if (typeof part === 'string') {
      payload.push(part)
    } else if (name === 'cpu' || name === 'net') {
      // an array of available cpu/net 
      if (Array.isArray(part)) {
        for (let idx = 0; idx < part.length; idx++) {
          const device = part[idx]
          if (name === 'cpu') {
            payload.push(device.model)
            // array of model, speed 
          }
          else if (name === 'net') {
            // array of name, address, mac
            //payload.push(device.name + device.addres + device.mac)
            payload.push(device.mac)
          }
        }
      }
    }
  }
  payload.sort()
  const fingerprint = Buffer.from(payload.join('')).toString('base64')
  return uuidv5(fingerprint, NAMESPACE)
}
