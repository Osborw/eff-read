const request = require('request')
const fs = require('fs');

const parseJSON = filename => {
  const rawdata = fs.readFileSync(`files/${filename}`)
  return JSON.parse(rawdata)
}

export const players = con => {
  console.log('Writing players to SQL')
  const URL = 'https://api.sleeper.app/v1/players/nfl'

  let data
  request(URL, function(error, response, body) {
    console.log('statusCode:', response && response.statusCode)
    if (error) {
      console.log('error:', error)
      data = parseJSON('nfl.json')
    } else {
      data = JSON.parse(body)
    }


    con.query(`DELETE FROM JSXR.players`, (err) => {
      if (err) console.log('Error delete from JSXR.players', err)
    })

    let ctr = 0

    Object.keys(data).map(id => {
      ctr++
      // console.log(ctr)
      const player = data[id]
      // console.log(player)
      const name = player.full_name
        ? player.full_name.replace(`'`, `\\'`)
        : null
      const team = player.team || 'FA'
      const position = player.position
      const status = player.status
      const injury_status = player.injury_status
      const active = player.active || false
      const age = player.age || -1
      const years_exp = player.years_exp === null ? -1 : player.years_exp
      const number = player.number || -1
      const height = player.height ? player.height.replace(`'`, `\\'`) : null
      const weight = player.weight || -1
      const depth_chart_position = player.depth_chart_position
      const depth_chart_order = player.depth_chart_order
      const fantasy_data_id =
        player.fantasy_data_id === null ? -1 : player.fantasy_data_id
      const stats_id = player.stats_id === null ? -1 : player.stats_id
      const espn_id = player.espn_id === null ? -1 : player.espn_id
      const injury_start_date =
        player.injury_start_date === undefined ? null : player.injury_start_date
      const search_rank = player.search_rank === null ? -1 : player.search_rank
      const fantasy_positions = player.fantasy_positions || ['unknown']
      if (!isNaN(id) && active) {
        fantasy_positions.map(p => {
          const query = `INSERT INTO JSXR.players 
        (id, name, team, position, fantasy_position, status, injury_status, active, age, years_exp, number, height, weight, depth_chart_position, depth_chart_order, search_rank, fantasy_data_id, stats_id, espn_id, injury_start_date)
        VALUES (${id}, '${name}', '${team}', '${position}', '${p}', '${status}', '${injury_status}', ${active}, '${age}', '${years_exp}', '${number}', '${height}', ${weight}, '${depth_chart_position}', ${depth_chart_order}, ${search_rank}, ${fantasy_data_id}, ${stats_id}, ${espn_id}, '${injury_start_date}');`

          con.query(query, function(error, results, fields) {
            if (error) console.log({ error })
          })
        })
      }
    })
  })
}

export const seasonStats = con => {
  console.log('Writing season stats to SQL')
  const URL = 'https://api.sleeper.app/v1/stats/nfl/regular/2019'

  request(URL, function(error, response, body) {
    let data
    console.log('statusCode:', response && response.statusCode)
    if (error) {
      console.log('Error loading season stats url', error)
      data = parseJSON('season.json')
    } else {
      data = JSON.parse(body)
    }

    con.query(`DELETE FROM JSXR.season`, (err) => {
      if (err) console.log('Error delete from JSXR.season', err)
    })

    const query = `SELECT id FROM JSXR.players ORDER BY id ASC;`

    con.query(query, (err, res, fields) => {
      const atts = new Set([])
      if (err) console.log({ err })
      res.map(p => {
        if (data[p.id]) {
          con.query(`INSERT INTO JSXR.season (id) VALUES (${p.id})`, (err, res, fields) => {
            if (err) console.log('Error on INSERT', {err})
          })
          Object.keys(data[p.id]).map(key => {
            atts.add(key)
            con.query(`UPDATE JSXR.season SET ${key} = ${data[p.id][key]} WHERE id = ${p.id}`, (err, res, fields) => {
              // if (err) console.log('Error on UPDATE', {err})
            })
          })
        }
      })
    })

  })
}
