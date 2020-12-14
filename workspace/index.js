
const WS = require('./workspace')

const main = () => {

  WS().then(App => {

    console.log('App ready')
  
  })
}

main()
