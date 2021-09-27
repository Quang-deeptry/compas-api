/* eslint-disable no-undef */
/* eslint-disable no-await-in-loop */
/* eslint-disable max-len */
/* eslint-disable array-callback-return */
/* eslint-disable global-require */
/* eslint-disable camelcase */
/* eslint-disable prefer-destructuring */
/* eslint-disable no-use-before-define */
// eslint-disable-next-line array-callback-return
const { google } = require('googleapis');
const readline = require('readline');
const fs = require('fs');
const moment = require('moment-timezone');
const request = require('request');
const createSlug = require('speakingurl');
const smtpTransport = require('./nodeMailer');
const {
  changeStringToNumber,
  asyncForEach,
  matchRoundPrice,
  countNumberOfCodes,
  countQuantity,
  delay,
} = require('../helpers');
const {
  LIST_ROLE,
  NOTIFICATION_TYPE,
} = require('../constants');

const {
  ProductPackages,
  Users,
  Threads,
  ProductCodes,
  Products,
  IndexProducts,
  Notifications,
} = require('../models');

const SCOPES = ['https://www.googleapis.com/auth/gmail.modify'];
const TOKEN_PATH = 'token.json';

module.exports = {
  index: async () => {
    try {
      fs.readFile('credentials.json', (err, content) => {
        if (err) return console.log('Error loading client secret file:', err);
        authorize(JSON.parse(content), listMessage);
      });
    } catch (error) {
      console.error(error);
    }
  },
  addProductsToStock: async () => {
    try {
      const users = await Users.find({ role: LIST_ROLE.OWNER })
        .select('restaurants')
        .lean();

      if (users.length) {
        fs.readdir('./fileExcel/', async (err, filenames) => {
          if (err) return console.error(`fileExcel Error: ${err}`);
          if (typeof require !== 'undefined') XLSX = require('xlsx');
          await asyncForEach(filenames, async (filename) => {
            const workbook = XLSX.readFile(`./fileExcel/${filename}`);

            const tableName = Object.keys(workbook.Sheets)[0];
            const infoName = Object.keys(workbook.Sheets)[1];

            delete workbook.Sheets[tableName]['!margins'];
            delete workbook.Sheets[tableName]['!rows'];
            delete workbook.Sheets[tableName]['!ref'];

            let i = 0;

            // push data of table 1
            const data = [];
            Object.keys(workbook.Sheets[tableName]).map((value) => {
              data.push(workbook.Sheets[tableName][value].v);
            });

            // push title
            const titles = [];
            for (i = 0; i < 7; i += 1) {
              titles.push(data[i]);
            }

            // push list product
            const dataTable = [];
            for (i = 7; i < data.length; i += 1) {
              dataTable.push(data[i]);
            }

            // push object product
            const products = [];
            for (i = 0; i < dataTable.length; i += 7) {
              await products.push({
                sku: dataTable[i],
                title: dataTable[i + 1],
                tariffs: {
                  unit: dataTable[i + 2],
                  price: changeStringToNumber(dataTable[i + 3]),
                },
                unit: dataTable[i + 4],
                quantity: changeStringToNumber(dataTable[i + 5]),
                totalPrice: matchRoundPrice(changeStringToNumber(dataTable[i + 6])),
              });
            }

            // total price all product
            let productPackageTotalPrice = 0;
            for (i = 0; i < products.length; i += 1) {
              productPackageTotalPrice += products[i].totalPrice;
            }

            const dataInfo = workbook.Sheets[infoName];

            const provider = {
              name: dataInfo.E3.v,
            };

            const orderCode = `16-${tableName.split(' ')[tableName.split(' ').length - 1]}`;

            await asyncForEach(users, (user) => {
              asyncForEach(user.restaurants, async (restaurant) => {
                try {
                  const listProduct = [];
                  // Khởi tạo thùng hàng
                  const productPackage = await ProductPackages.create({
                    restaurant,
                    orderCode,
                    deliveryScheduled: new Date(),
                    provider: provider.name,
                    user: user._id,
                    quantity: products.length,
                    totalPrice: productPackageTotalPrice,
                  });

                  let converter = 1;

                  // Kiểm tra và khởi tạo sản phẩm - code của sản phẩm
                  await asyncForEach(products, async (product) => {
                    try {
                    // Khởi tạo các giá trị mặc định
                      let title = product.title;
                      let numberOfCodes = product.quantity * 1;
                      let productCodeQuantity = await countQuantity(product.quantity, numberOfCodes);
                      let productCodePrice = product.totalPrice / numberOfCodes;
                      let mergeIndexProduct = null;
                      let referenceProduct = null;
                      const sku = product.sku || '';

                      const checkProductNameAndSku = await IndexProducts.findOne({
                        oldTitle: product.title,
                        sku,
                      }).select('_id title converter quantity').lean();

                      const checkProductSku = await IndexProducts.findOne({
                        sku,
                      }).select('_id product productPackage').lean();

                      const checkProductName = await IndexProducts.findOne({
                        oldTitle: product.title,
                      }).select('_id product productPackage').lean();

                      if (checkProductNameAndSku) { // cùng tên & sku
                        title = checkProductNameAndSku.title;
                        converter = checkProductNameAndSku.converter;
                        numberOfCodes = await countNumberOfCodes(checkProductNameAndSku.converter, product.quantity);
                        productCodeQuantity = await countQuantity(product.quantity, numberOfCodes);
                        productCodePrice = product.totalPrice / numberOfCodes;
                        referenceProduct = checkProductNameAndSku._id;
                      } else if (checkProductSku && (checkProductSku.productPackage.toString() !== productPackage._id.toString())) { // cùng sku
                      } else if (checkProductSku) { // cùng sku
                        mergeIndexProduct = checkProductSku._id;
                        referenceProduct = checkProductSku._id;
                      } else if (checkProductName && (checkProductName.productPackage.toString() !== productPackage._id.toString())) { // cùng tên
                      } else if (checkProductName) { // cùng tên
                        mergeIndexProduct = checkProductName._id;
                        referenceProduct = checkProductName._id;
                      } // khác tên & sku => lấy thông tin mặc định

                      // Tạo sản phẩm tham chiếu
                      if (!checkProductNameAndSku) {
                        const newIndexProduct = await IndexProducts.create({
                          title,
                          oldTitle: title,
                          slug: createSlug(title),
                          sku,
                          provider: provider.name,
                          restaurant,
                          productPackage: productPackage._id,
                        });
                        referenceProduct = newIndexProduct._id;
                      }
                      // Tạo sản phẩm
                      const newProduct = await Products.create({
                        converter,
                        title,
                        sku,
                        user: user._id,
                        restaurant,
                        productPackage: productPackage._id,
                        slug: createSlug(title),
                        tariffs: {
                          unit: product.tariffs.unit,
                          price: product.tariffs.price,
                        },
                        quantity: product.quantity,
                        unit: product.unit,
                        totalPrice: product.totalPrice,
                        expDate: product.expDate || null,
                        mergeIndexProduct,
                        referenceProduct,
                      });

                      await listProduct.push(newProduct._id);

                      // Tạo codes cho sản phẩm
                      await asyncForEach(numberOfCodes, async () => {
                        try {
                          await ProductCodes.create({
                            quantity: productCodeQuantity,
                            totalPrice: productCodePrice,
                            productPackage: productPackage._id,
                            product: newProduct._id,
                            user: newProduct.user,
                            restaurant: newProduct.restaurant,
                            title: newProduct.title,
                            slug: createSlug(newProduct.title),
                            tariffs: {
                              unit: newProduct.tariffs.unit,
                              price: newProduct.tariffs.price,
                            },
                            unit: newProduct.unit,
                            sku: newProduct.sku,
                            referenceProduct,
                          });
                        } catch (error) {
                          console.log('Error numbercode loop', error);
                        }
                      });
                    } catch (error) {
                      console.log('Error product loop', error);
                    }
                  });

                  // Cập nhập danh sách sản phẩm của thùng hàng
                  await ProductPackages.findByIdAndUpdate(productPackage._id, {
                    products: listProduct,
                  });
                  const newNotification = await Notifications.create({
                    type: NOTIFICATION_TYPE.NEW_ORDER,
                    message: 'Vous avez une nouvelle commande',
                  });
                  global.socketIO.to(global.listSocketUser.socketId[restaurant]).emit('user-has-new-notification', newNotification);
                } catch (error) {
                  console.log('Error restaurent loop', error);
                }
              });
            });

            // eslint-disable-next-line no-shadow
            fs.unlink(`./fileExcel/${filename}`, (err) => {
              if (err) return console.error(err);
            });
          });
          // eslint-disable-next-line no-useless-return
          return;
        });
      }
    } catch (error) {
      console.error(error);
    }
  },
};

const authorize = (credentials, callback) => {
  try {
    const { client_id, client_secret, redirect_uris } = credentials.web;
    const oAuth2Client = new google.auth.OAuth2(
      client_id, client_secret, redirect_uris[0],
    );

    fs.readFile(TOKEN_PATH, (err, token) => {
      if (err) return getNewToken(oAuth2Client);
      oAuth2Client.setCredentials(JSON.parse(token));
      callback(oAuth2Client);
    });
  } catch (error) {
    console.error(error);
  }
};

const getNewToken = (oAuth2Client) => {
  try {
    const authUrl = oAuth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: SCOPES,
      prompt: 'consent',
    });
    return console.log('Authorize this app by visiting this url:', authUrl);
  } catch (error) {
    console.error(error);
  }
};

const listMessage = (auth, query) => {
  try {
    return new Promise((resolve, reject) => {
      const gmail = google.gmail({ version: 'v1', auth });
      const mailOfProviders = [
        'quangdeeptry7@gmail.com',
        'resa@gmail.com',
        'resb@gmail.com',
        'luantpm42@due.edu.vn',
        'trinhphuong.designer@gmail.com',
        'dinhphuongdhkt@gmail.com',
        'lampndev@gmail.com',
        'netresto.noreply@netresto.com',
        'adrien.goullard@it-trattoria.com',
      ];
      // const mailOfProvider = process.env.EMAIL_BUSINESS;
      // eslint-disable-next-line no-param-reassign
      asyncForEach(mailOfProviders, (mailOfProvider) => {
        gmail.users.threads.list({
          userId: 'me',
          q: `is:unread from:${mailOfProvider}`,
          maxResults: 10,
        }, async (err, resource) => {
          if (err) return reject(err);
          if (resource.data.resultSizeEstimate > 0) {
            for (i = 0; i < resource.data.threads.length; i += 1) {
              const findThreadId = await Threads.findOne({
                threadId: resource.data.threads[i].id,
              }).lean();

              if (!findThreadId) {
                await getMessage(resource.data.threads[i].id, auth);
                await Threads.create({
                  threadId: resource.data.threads[i].id,
                  snippet: resource.data.threads[i].snippet,
                  historyId: resource.data.threads[i].historyId,
                });
              }

              await unreadMessage(resource.data.threads[i].id, auth);
            }
          }
        });
      });
    });
  } catch (error) {
    console.error(error);
  }
};

const getMessage = async (messageId, auth) => {
  try {
    const gmail = google.gmail({ version: 'v1', auth });

    const result = await gmail.users.messages.get({
      userId: 'me',
      id: messageId,
    });

    const { attachmentId } = result.data.payload.parts[1].body;
    const parts = result.data.payload.parts[1];

    if (attachmentId && parts) {
      // eslint-disable-next-line max-len
      await getAttachment(attachmentId, messageId, auth, parts, async (filename, mineType, attachment) => {
        const fileContents = Buffer.from(attachment.data, 'base64');
        const token = Math.random().toString(36).substr(7);
        const checkFilename = filename.split('.');

        if (checkFilename[1] === 'xls' || checkFilename[1] === 'xlsx') {
          await writeFileExel(`./fileExcel/${token}-${filename}`, fileContents);
        }
      });
    }
  } catch (error) {
    console.error(error);
  }
};

const unreadMessage = async (messageId, auth) => {
  try {
    const gmail = google.gmail({ version: 'v1', auth });
    gmail.users.messages.modify({
      userId: 'me',
      id: messageId,
      resource: {
        removeLabelIds: [
          'UNREAD',
        ],
      },
    }, (err, res) => {
      if (err) return console.log(err);
    });
  } catch (error) {
    console.error(error);
  }
};

const convertPdfToExcel = async (filename) => {
  try {
    fs.readFile(`./files/${filename}`, 'utf-8', (err) => {
      if (err) return console.error(err);
      // convert file name
      const newFilename = filename.split('.')[0];
      // pdf table account:           // 8053pcb9h5m5
      // username
      // password
      // orrqvfn1u6xs
      const url = `https://pdftables.com/api?key=${process.env.KEY_PDFTABLE}&format=xlsx-single`;
      // eslint-disable-next-line no-shadow
      const result = request.post({ encoding: null, url }, async (err, resp, body) => {
        if (!err && resp.statusCode === 200) {
          // eslint-disable-next-line no-shadow
          fs.writeFileSync(`./fileExcel/${newFilename}.xlsx`, body, (err) => {
            if (err) console.error('error writing file');
          });
        } else {
          const mailOptions = {
            to: process.env.EMAIL_ADDRESS,
            from: process.env.EMAIL_ADDRESS,
            subject: 'AVIS TABLEAU PDF SUR MILLIARD',
            html: `
            <!DOCTYPE html>
              <html lang="en">
              <head>
                <meta charset="UTF-8">
                <meta http-equiv="X-UA-Compatible" content="IE=edge">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>Send inbox</title>
              </head>
              <body>
                <table width="100%" height="100%" style="min-width:348px" border="0" cellspacing="0" cellpadding="0" lang="en">
                  <tbody>
                    <tr height="32" style="height:32px">
                      <td></td>
                    </tr>
                    <tr align="center">
                      <td>
                        <div>
                          <div></div>
                        </div>
                        <table border="0" cellspacing="0" cellpadding="0" style="padding-bottom:20px;max-width:516px;min-width:220px">
                          <tbody>
                            <tr>
                              <td width="8" style="width:8px"></td>
                              <td>
                                <div
                                  style="border-style:solid;border-width:thin;border-color:#dadce0;border-radius:8px;padding:40px 20px"
                                  align="center" class="m_8403306095834361427mdv2rw">
                                  <img width="240" height="100" src='http://compas.wii.camp/Logo.svg' alt='logo compas' />
                                  <div
                                    style="font-family:'Google Sans',Roboto,RobotoDraft,Helvetica,Arial,sans-serif;border-bottom:thin solid #dadce0;color:rgba(0,0,0,0.87);line-height:32px;padding-bottom:24px;text-align:center;word-break:break-word">
                                    <div style="font-size:20px">Bonjour <b>${process.env.EMAIL_ADDRESS}</b>, le système COMPAS arrête temporairement
                                      d'accepter
                                      les factures</div>
                                  </div>
                                  <div
                                    style="font-family:Roboto-Regular,Helvetica,Arial,sans-serif;font-size:14px;color:rgba(0,0,0,0.87);line-height:20px;padding-top:20px;text-align:left">
                                    <br>Nous avons remarqué que le système COMPAS a temporairement cessé de recevoir des factures car
                                    le service de conversion de données de fichiers PDF devait être étendu pour continuer à faire
                                    fonctionner le système.
                                    <br />
                                    Compte de connexion TABLEAU PDF <br />
                                    <b>Nom d'utilisateur</b>: noreply.test.send@gmail.com <br />
                                    <b>le mot de passe</b>: Wiicamp@123
                                    <div style="padding-top:32px;text-align:center">
                                      <a href="https://pdftables.com/pricing"
                                        style="font-family:'Google Sans',Roboto,RobotoDraft,Helvetica,Arial,sans-serif;line-height:16px;color:#ffffff;font-weight:400;text-decoration:none;font-size:14px;display:inline-block;padding:10px 24px;background-color:#4184f3;border-radius:5px;min-width:90px"
                                        target="_blank">
                                        Voir plus d'infos ici
                                      </a>
                                    </div>
                                  </div>
                                  <div
                                    style="padding-top:20px;font-size:12px;line-height:16px;color:#5f6368;letter-spacing:0.3px;text-align:center">
                                    Voir plus sur la page d'accueil<br>
                                    <a href='https://pdftables.com/' target='_blank'
                                      style="color:rgba(0,0,0,0.87);text-decoration:inherit"> https://pdftables.com/ </a>
                                  </div>
                                </div>
                                <div style="text-align:left">
                                  <div
                                    style="font-family:Roboto-Regular,Helvetica,Arial,sans-serif;color:rgba(0,0,0,0.54);font-size:11px;line-height:18px;padding-top:12px;text-align:center">
                                    <div>Nous vous envoyons cet e-mail pour vous informer que le service PDF doit être renouvelé.
                                    </div>
                                    <div style="direction:ltr">© COMPAS,
                                    </div>
                                  </div>
                                </div>
                              </td>
                              <td width="8" style="width:8px"></td>
                            </tr>
                          </tbody>
                        </table>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </body>
              </html>
            `,
          };

          await smtpTransport.sendMail(mailOptions);
        }
      });

      const form = result.form();
      form.append('file', fs.createReadStream(`./files/${filename}`));

      // eslint-disable-next-line no-shadow
      fs.unlink(`./files/${filename}`, (err) => {
        if (err) return console.error(err);
      });
    });
  } catch (error) {
    console.error(error);
  }
};

const getAttachment = async (attachmentId, messageId, auth, parts, callback) => {
  try {
    const gmail = google.gmail({ version: 'v1', auth });
    const result = await gmail.users.messages.attachments.get({
      userId: 'me',
      id: attachmentId,
      messageId,
    });

    callback(parts.filename, parts.mimeType, result.data);
  } catch (error) {
    console.log(error);
  }
};

const writeFileExel = async (filename, fileContents) => {
  fs.writeFileSync(filename, fileContents, (err) => {
    if (err) return console.error(err);
  });
};
