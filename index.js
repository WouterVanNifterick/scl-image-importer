const fs = require('fs');
var mysql = require('mysql');

const walk = function(dir, ext) {
    let results = [];
    console.log(dir);
    const list = fs.readdirSync(dir);
    list.forEach(function(file) {
        file = dir + '/' + file;
        const stat = fs.statSync(file);
        if (stat && stat.isDirectory()) { 
            results = results.concat(walk(file, ext));
        } else { 
            file_type = file.split(".").pop();
            file_name = file.split(/(\\|\/)/g).pop();
            if (file_type == ext) {
                const imageInfo = require(`${file}`);
                anpr = imageInfo.registration.finalANPRResult;                
                let res = {
                    filename: file,
                    lp : anpr.licensePlateNumber,
                    country : anpr.nationality,
                    timestamp: new Date(imageInfo.registration.time.timestamp * 1000.0 + imageInfo.registration.time.milliSeconds),
                    len : anpr.vehicleLength,
                    conf : anpr.ocrScore,
                    classifier_rdwclass: imageInfo.classifierInfo?imageInfo.classifierInfo.result.rdwvehicleclass:'NULL',
                    coords : {
                        topleftx     : anpr.plateTopLeftX,
                        toplefty     : anpr.plateTopLeftY,
                        toprightx    : anpr.plateTopRightX,
                        toprighty    : anpr.plateTopRightY,
                        bottomleftx  : anpr.plateBottomLeftX,
                        bottomlefty  : anpr.plateBottomLeftY,
                        bottomrightx : anpr.plateBottomRightX,
                        bottomrighty : anpr.plateBottomRightY,
                    }
                }
                if(res.lp != '')
                    results.push(res);
            }
        }
    });
    // var sql=[];
    let insertSQL = [];
    results.forEach(f=>{
        insertSQL.push(`('${f.filename.replace(startDir,'') }', '${f.timestamp.toISOString().replace("T"," ").replace("Z","")}', '${f.lp.replace(/ /g,"")}', '${f.country}', ${f.len}, ${f.conf}, ${f.coords.topleftx}, ${f.coords.toplefty}, ${f.coords.toprightx}, ${f.coords.toprighty}, ${f.coords.bottomrightx}, ${f.coords.bottomrighty}, ${f.coords.bottomleftx}, ${f.coords.bottomlefty}, '${f.classifier_rdwclass}')`);
    });
    insertSQL = `INSERT IGNORE INTO scl_image (filename, timestamp, lp, country, len, conf, topleftx, toplefty, toprightx, toprighty, bottomrightx, bottomrighty, bottomleftx, bottomlefty, classifier_rdwclass) VALUES ` + insertSQL.join(", \n");
    console.log(insertSQL);
    dbConn.connect(); 
    dbConn.query(insertSQL, [], function (error, results, fields) {
        if (error) {
          console.log(error);
//          return;
        }        
        console.log(results);
        dbConn.commit();
    });

    // var allSQL=sql.join("\n");
    // var fileName=startDir+"/import.sql";
    // 
    // fs.appendFile(fileName, allSQL, function(err) {
    //     if(err) {
    //         return console.log(err);
    //     }
    //     console.log(`${fileName} was saved!`);
    // }); 
    return results;
}

  
// connect to database
var dbConn = mysql.createConnection({
    host: '10.4.1.23',
    user: 'scl_api.user',
    password: 'scl',
    database: 'scapeye'
});
//dbConn.connect(); 
const startDir = process.argv[2];
walk(startDir,'json');
