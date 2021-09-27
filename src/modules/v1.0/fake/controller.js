/* eslint-disable max-len */
/* eslint-disable no-nested-ternary */
const createSlug = require('speakingurl');
const momentTZ = require('moment-timezone');
const moment = require('moment');
const { promisify } = require('util');
const { ObjectId } = require('mongoose').Types;
const {
  Users,
  ProductPackages,
  Products,
  ProductCodes,
  IndexProducts,
  UserManualChangeStatus,
  Restaurants,
  Notifications,
} = require('../../../models');

const {
  LIST_ROLE,
  EMAIL_STATUS,
  PRODUCT_STATUS,
  NOTIFICATION_TYPE,
} = require('../../../constants');
const {
  apiResponse, asyncForEach, matchRoundPrice,
  currencyFormat, numberFormat, getEmail,
  countNumberOfCodes, countQuantity, delay,
} = require('../../../helpers');
const smtpTransport = require('../../../services/nodeMailer');

module.exports = {
  fakeProduct: async (req, res, next) => {
    try {
      const {
        provider, products, productPackageTotalPrice,
        time, orderCode,
      } = req.body;
      const listProduct = [];
      const t = time.split('/');
      const nwD = new Date();
      const timeMoment = momentTZ(`${t[2]}-${t[1]}-${t[0]} ${nwD.getHours()}:${nwD.getMinutes()} +2`, 'YYYY-MM-DD HH:mm Z')
        .tz('Europe/Paris').format('YYYY-MM-DD HH:mm');

      const user = await Users.findOne({ email: provider.email, role: LIST_ROLE.OWNER })
        .select('restaurants')
        .lean();

      if (user) {
        asyncForEach(user.restaurants, async (restaurant) => {
          // Khởi tạo thùng hàng
          const productPackage = await ProductPackages.create({
            restaurant,
            orderCode,
            deliveryScheduled: timeMoment,
            provider: provider.name,
            user: user._id,
          });

          let countPriceOfPackage = 0;
          const countQuantityOfPackage = products.length;
          let i = 0;
          const productsLength = products.length;
          // Kiểm tra và khởi tạo sản phẩm - code của sản phẩm
          for (i = 0; i < productsLength; i += 1) {
            // Khởi tạo các giá trị mặc định
            let { title } = products[i];
            let converter = 1;
            let numberOfCodes = products[i].quantity * converter;
            let productCodeQuantity = await countQuantity(products[i].quantity, numberOfCodes);
            let productCodePrice = products[i].totalPrice / numberOfCodes;
            let mergeIndexProduct = null;
            let referenceProduct = null;
            const sku = products[i].sku || '';

            countPriceOfPackage += products[i].totalPrice;

            const checkProductNameAndSku = await IndexProducts.findOne({
              oldTitle: products[i].title,
              sku,
            }).select('_id title converter quantity').lean();

            const checkProductSku = await IndexProducts.findOne({
              sku,
            }).select('_id product productPackage').lean();

            const checkProductName = await IndexProducts.findOne({
              oldTitle: products[i].title,
            }).select('_id product productPackage').lean();

            if (checkProductNameAndSku) { // cùng tên & sku
              console.log('cùng tên & sku');
              title = checkProductNameAndSku.title;
              converter = checkProductNameAndSku.converter;
              numberOfCodes = await countNumberOfCodes(checkProductNameAndSku.converter, products[i].quantity);
              productCodeQuantity = await countQuantity(products[i].quantity, numberOfCodes);
              productCodePrice = products[i].totalPrice / numberOfCodes;
              referenceProduct = checkProductNameAndSku._id;
            } else if (checkProductSku && (checkProductSku.productPackage.toString() !== productPackage._id.toString())) { // cùng sku
              console.log('cùng sku');
              mergeIndexProduct = checkProductSku._id;
              referenceProduct = checkProductSku._id;
            } else if (checkProductName && (checkProductName.productPackage.toString() !== productPackage._id.toString())) { // cùng tên
              console.log('cùng tên');
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
            const product = await Products.create({
              converter,
              title,
              sku,
              user: user._id,
              restaurant,
              productPackage: productPackage._id,
              slug: createSlug(title),
              tariffs: {
                unit: products[i].tariffs.unit,
                price: products[i].tariffs.price,
              },
              quantity: products[i].quantity,
              unit: products[i].unit,
              totalPrice: matchRoundPrice(Number(products[i].totalPrice)),
              expDate: products[i].expDate || null,
              mergeIndexProduct,
              referenceProduct,
            });
            listProduct.push(product._id);

            // Tạo codes cho sản phẩm
            let j = 0;

            for (j; j < numberOfCodes; j += 1) {
              await ProductCodes.create({
                quantity: productCodeQuantity,
                totalPrice: matchRoundPrice(Number(productCodePrice)),
                productPackage: productPackage._id,
                product: product._id,
                user: product.user,
                restaurant: product.restaurant,
                title: product.title,
                slug: createSlug(product.title),
                tariffs: {
                  unit: product.tariffs.unit,
                  price: product.tariffs.price,
                },
                unit: product.unit,
                sku: product.sku,
                referenceProduct,
              });
              await delay(50);
            }
          }
          // Cập nhập danh sách sản phẩm của thùng hàng
          await ProductPackages.findByIdAndUpdate(productPackage._id, {
            products: listProduct,
            quantity: countQuantityOfPackage,
            totalPrice: matchRoundPrice(Number(productPackageTotalPrice)) || matchRoundPrice(Number(countPriceOfPackage)),
          });

          const newNotification = await Notifications.create({
            type: NOTIFICATION_TYPE.NEW_ORDER,
            message: 'Vous avez une nouvelle commande',
          });
          global.socketIO.to(global.listSocketUser.socketId[restaurant]).emit('user-has-new-notification', newNotification);
        });
        return res.json(apiResponse({
          message: 'fake data success',
        }));
      }
    } catch (error) {
      next(error);
    }
  },

  fakeReportEmail: async (req, res, next) => {
    try {
      const today = new Date();

      const sevenDays = moment().subtract(7, 'days').toString();
      const oneDays = moment().subtract(1, 'days').toString();
      const TwoDay = moment().subtract(2, 'days').toString();

      const aWeekAgo = moment(sevenDays).startOf('day').add(3, 'hours');
      const aDayAgo = moment(oneDays).startOf('day').add(3, 'hours');
      const TwoDayAgo = moment(TwoDay).startOf('day').add(3, 'hours');

      const restaurants = await Restaurants
        .aggregate([
          {
            $lookup: {
              from: 'emails',
              localField: '_id',
              foreignField: 'restaurant',
              as: 'emails',
            },
          },
          {
            $unwind: {
              path: '$emails._id',
              preserveNullAndEmptyArrays: true,
            },
          },
          {
            $lookup: {
              from: 'product_packages',
              localField: '_id',
              foreignField: 'restaurant',
              as: 'packages',
            },
          },
          {
            $project: {
              restaurantName: 1,
              emails: {
                $filter: {
                  input: '$emails',
                  as: 'item',
                  cond: { $eq: ['$$item.type', EMAIL_STATUS.REPORT] },
                },
              },
              numberOfPackages: {
                $size: '$packages',
              },
            },
          },
          {
            $match: { numberOfPackages: { $gt: 0 } },
          },
          {
            $project: {
              restaurantName: 1,
              emails: {
                email: 1,
              },
              numberOfPackages: 1,
            },
          },
        ]);

      await asyncForEach(restaurants, async (restaurant) => {
        try {
          const allProductOfRestaurant = await IndexProducts
            .aggregate()
            .match({ restaurant: restaurant._id })
            .lookup({
              from: 'product_codes',
              localField: '_id',
              foreignField: 'referenceProduct',
              as: 'productCodes',
            })
            .unwind({
              path: '$productCodes',
              preserveNullAndEmptyArrays: true,
            })
            .match({ 'productCodes.status': PRODUCT_STATUS.FULL })
            .group({
              _id: '$_id',
              title: { $first: '$title' },
              countPlein: { $sum: 1 },
              quantityPlein: { $sum: '$productCodes.quantity' },
              pricePlein: { $sum: '$productCodes.totalPrice' },
            });

          const listManualChangeStatus = await UserManualChangeStatus
            .aggregate()
            .match({
              restaurant: restaurant._id,
              createdAt: { $gte: new Date(aWeekAgo), $lte: new Date(today) },
            })
            .group({
              _id: '$referenceProduct', manualChangeStatus: { $sum: 1 },
            });

          const data7days = await IndexProducts
            .aggregate([
              {
                $match: { restaurant: restaurant._id },
              },
              {
                $lookup: {
                  from: 'product_codes',
                  localField: '_id',
                  foreignField: 'referenceProduct',
                  as: 'productCodes',
                },
              },
              {
                $unwind: {
                  path: '$productCodes._id',
                  preserveNullAndEmptyArrays: true,
                },
              },
              {
                $project: {
                  _id: 1,
                  numberOfEmptyAndOpenAWeek: {
                    $size: {
                      $filter: {
                        input: '$productCodes',
                        as: 'item',
                        cond: {
                          $and: [
                            { $in: ['$$item.status', [PRODUCT_STATUS.EMPTY, PRODUCT_STATUS.OPEN]] },
                            { $gte: ['$$item.updatedAt', new Date(aWeekAgo)] },
                            { $lte: ['$$item.updatedAt', new Date(today)] },
                          ],
                        },
                      },
                    },
                  },
                  quantityEmptyAWeek: {
                    $size: {
                      $filter: {
                        input: '$productCodes',
                        as: 'item',
                        cond: {
                          $and: [
                            { $eq: ['$$item.status', PRODUCT_STATUS.EMPTY] },
                            { $gte: ['$$item.updatedAt', new Date(aWeekAgo)] },
                            { $lte: ['$$item.updatedAt', new Date(today)] },
                          ],
                        },
                      },
                    },
                  },
                  dataEmptyAndOpenAWeek: {
                    $filter: {
                      input: '$productCodes',
                      as: 'item',
                      cond: {
                        $and: [
                          { $in: ['$$item.status', [PRODUCT_STATUS.EMPTY, PRODUCT_STATUS.OPEN]] },
                          { $gte: ['$$item.updatedAt', new Date(aWeekAgo)] },
                          { $lte: ['$$item.updatedAt', new Date(today)] },
                        ],
                      },
                    },
                  },
                  dataEmptyAWeek: {
                    $filter: {
                      input: '$productCodes',
                      as: 'item',
                      cond: {
                        $and: [
                          { $eq: ['$$item.status', PRODUCT_STATUS.EMPTY] },
                          { $gte: ['$$item.updatedAt', new Date(aWeekAgo)] },
                          { $lte: ['$$item.updatedAt', new Date(today)] },
                        ],
                      },
                    },
                  },
                },
              },
              {
                $project: {
                  quantityEmptyAWeek: 1,
                  totalEmptyPriceAWeek: { $sum: '$dataEmptyAWeek.totalPrice' },
                  totalQuantityEmptyAWeek: { $sum: '$dataEmptyAWeek.quantity' },
                  numberOfEmptyAndOpenAWeek: 1,
                  totalEmptyAndOpenPriceAWeek: { $sum: '$dataEmptyAndOpenAWeek.totalPrice' },
                  totalQuantityOfEmptyAndOpenAWeek: { $sum: '$dataEmptyAndOpenAWeek.quantity' },
                },
              },
            ]);

          const data2days = await IndexProducts
            .aggregate([
              {
                $match: { restaurant: restaurant._id },
              },
              {
                $lookup: {
                  from: 'product_codes',
                  localField: '_id',
                  foreignField: 'referenceProduct',
                  as: 'productCodes',
                },
              },
              {
                $unwind: {
                  path: '$productCodes._id',
                  preserveNullAndEmptyArrays: true,
                },
              },
              {
                $project: {
                  _id: 1,
                  numberOfEmptyAndOpen2Days: {
                    $size: {
                      $filter: {
                        input: '$productCodes',
                        as: 'item',
                        cond: {
                          $and: [
                            { $in: ['$$item.status', [PRODUCT_STATUS.EMPTY, PRODUCT_STATUS.OPEN]] },
                            { $gte: ['$$item.updatedAt', new Date(TwoDayAgo)] },
                            { $lte: ['$$item.updatedAt', new Date(aDayAgo)] },
                          ],
                        },
                      },
                    },
                  },
                  quantityEmpty2Days: {
                    $size: {
                      $filter: {
                        input: '$productCodes',
                        as: 'item',
                        cond: {
                          $and: [
                            { $eq: ['$$item.status', PRODUCT_STATUS.EMPTY] },
                            { $gte: ['$$item.updatedAt', new Date(TwoDayAgo)] },
                            { $lte: ['$$item.updatedAt', new Date(aDayAgo)] },
                          ],
                        },
                      },
                    },
                  },
                  dataEmptyAndOpen: {
                    $filter: {
                      input: '$productCodes',
                      as: 'item',
                      cond: {
                        $and: [
                          { $in: ['$$item.status', [PRODUCT_STATUS.EMPTY, PRODUCT_STATUS.OPEN]] },
                          { $gte: ['$$item.updatedAt', new Date(TwoDayAgo)] },
                          { $lte: ['$$item.updatedAt', new Date(aDayAgo)] },
                        ],
                      },
                    },
                  },
                  dataEmpty: {
                    $filter: {
                      input: '$productCodes',
                      as: 'item',
                      cond: {
                        $and: [
                          { $eq: ['$$item.status', PRODUCT_STATUS.EMPTY] },
                          { $gte: ['$$item.updatedAt', new Date(TwoDayAgo)] },
                          { $lte: ['$$item.updatedAt', new Date(aDayAgo)] },
                        ],
                      },
                    },
                  },
                },
              },
              {
                $project: {
                  quantityEmpty2Days: 1,
                  totalEmptyPrice2Days: { $sum: '$dataEmpty.totalPrice' },
                  totalQuantityEmpty2Days: { $sum: '$dataEmpty.quantity' },
                  numberOfEmptyAndOpen2Days: 1,
                  totalEmptyAndOpenPrice2Days: { $sum: '$dataEmptyAndOpen.totalPrice' },
                  totalQuantityEmptyAndOpen2Days: { $sum: '$dataEmptyAndOpen.quantity' },
                },
              },
            ]);

          const listReportProduct = allProductOfRestaurant.map(
            (item, i) => (
              {
                ...item,
                ...listManualChangeStatus.find(({ _id }) => _id.toString() === item._id.toString()),
                ...data2days.find(({ _id }) => _id.toString() === item._id.toString()),
                ...data7days.find(({ _id }) => _id.toString() === item._id.toString()),
              }
            ),
          );

          // const listReportProduct = [];
          // allProductOfRestaurant.forEach(async (item) => {
          //   const listManual = await listManualChangeStatus.find(({ _id }) => _id.toString() === item._id.toString());
          //   const data2 = await data2days.find(({ _id }) => _id.toString() === item._id.toString());
          //   const data7 = await data7days.find(({ _id }) => _id.toString() === item._id.toString());

          //   const object = await {
          //     ...item, ...listManual, ...data2, ...data7,
          //   };
          //   listReportProduct.push(object);
          // });

          const dataTable = listReportProduct.map((item) => {
            const discrepancy = !item.manualChangeStatus || item.manualChangeStatus === 0 ? '0%' : item.countPlein > 0 ? `${numberFormat((item.manualChangeStatus / item.countPlein) * 100)}%` : 'Le produit est vide';
            return (
              `<tr>
                <td>${item.title}</td>
                <td>${discrepancy}</td>
                <td>${(item.quantityPlein).toFixed(2)}</td>
                <td>${currencyFormat(item.pricePlein)}</td>
                <td>${item.totalQuantityEmptyAndOpen2Days}</td>
                <td>${item.totalQuantityEmpty2Days}</td>
                <td>${currencyFormat(item.totalEmptyAndOpenPrice2Days)}</td>
                <td>${currencyFormat(item.totalEmptyPrice2Days)}</td>
                <td>${item.totalQuantityOfEmptyAndOpenAWeek}</td>
                <td>${item.totalQuantityEmptyAWeek}</td>
                <td>${currencyFormat(item.totalEmptyAndOpenPriceAWeek)}</td>
                <td>${currencyFormat(item.totalEmptyPriceAWeek)}</td>
              </tr>`
            );
          });

          const totalPricePlein = listReportProduct.reduce((sum, number) => {
            const updatedSum = sum + number.pricePlein;
            return updatedSum;
          }, 0);
          const totalQuantityPlein = listReportProduct.reduce((sum, number) => {
            const updatedSum = sum + number.quantityPlein;
            return updatedSum;
          }, 0);
          const totalManualChange = listReportProduct.reduce((sum, number) => {
            const updatedSum = number.manualChangeStatus ? sum + number.manualChangeStatus : sum + 0;
            return updatedSum;
          }, 0);

          const totalEmpty2day = listReportProduct.reduce((sum, number) => {
            const result = sum + number.totalQuantityEmpty2Days;
            return result;
          }, 0);
          const totalEmptyPrice2day = listReportProduct.reduce((sum, number) => {
            const result = sum + number.totalEmptyPrice2Days;
            return result;
          }, 0);
          const totalEmptyAndOpen2day = listReportProduct.reduce((sum, number) => {
            const result = sum + number.totalQuantityEmptyAndOpen2Days;
            return result;
          }, 0);
          const totalEmptyAndOpenPrice2day = listReportProduct.reduce((sum, number) => {
            const result = sum + number.totalEmptyAndOpenPrice2Days;
            return result;
          }, 0);

          const totalEmptyAWeek = listReportProduct.reduce((sum, number) => {
            const result = sum + number.totalQuantityEmptyAWeek;
            return result;
          }, 0);
          const totalEmptyPriceAWeek = listReportProduct.reduce((sum, number) => {
            const result = sum + number.totalEmptyPriceAWeek;
            return result;
          }, 0);
          const totalEmptyAndOpenAweek = listReportProduct.reduce((sum, number) => {
            const result = sum + number.totalQuantityOfEmptyAndOpenAWeek;
            return result;
          }, 0);
          const totalEmptyAndOpenPriceAWeek = listReportProduct.reduce((sum, number) => {
            const result = sum + number.totalEmptyAndOpenPriceAWeek;
            return result;
          }, 0);

          const totalRow = `<tr>
              <th scope="row">Total</th>
              <td></td>
              <td>${totalQuantityPlein}</td>
              <td>${currencyFormat(totalPricePlein)}</td>
              <td>${totalEmptyAndOpen2day}</td>
              <td>${totalEmpty2day}</td>
              <td>${currencyFormat(totalEmptyAndOpenPrice2day)}</td>
              <td>${currencyFormat(totalEmptyPrice2day)}</td>
              <td>${totalEmptyAndOpenAweek}</td>
              <td>${totalEmptyAWeek}</td>
              <td>${currencyFormat(totalEmptyAndOpenPriceAWeek)}</td>
              <td>${currencyFormat(totalEmptyPriceAWeek)}</td>
            </tr>`;

          const emailTo = restaurant.emails[0];
          restaurant.emails.splice(0, 1);
          const emailCC = restaurant.emails.map((m) => m.email).join(', ');
          console.log(`To ${emailTo.email} emailCC: ${emailCC}`);

          const mailOptions = {
            to: emailTo.email,
            from: process.env.EMAIL_ADDRESS,
            cc: emailCC,
            subject: 'E-mail de rapport de données hebdomadaire de Compas',
            html: `<html lang="en-US">
                      <head>
                      <meta content="text/html; charset=utf-8" http-equiv="Content-Type" />
                      <title>Modèle d'e-mail de réinitialisation du mot de passe</title>
                      <meta name="description" content="Modèle d'e-mail de réinitialisation du mot de passe." />
                      <style type="text/css">
                      body {
                        font-family: Arial, Helvetica, sans-serif;
                      }
                      th {
                        background: #009C7C;
                      }
                      td {
                        font-size: 14px;
                        word-wrap: break-word;
                      }
                      </style>

                      <body style="margin: 0px; padding: 20px; background-color: #f2f3f8;" leftmargin="0" font-family:'Rubik', sans-serif;>
                      <h1 style="font-weight:500; font-size:32px; text-align:center">Données du rapport journalier Compas</h1>
                      <table width="100%">
                      <tr>
                      <td>De: Compas System</td>
                      </tr>
                      <tr>
                      <td>Nom du restaurant: ${restaurant.restaurantName}</td>
                      </tr>
                      <tr>
                      <td>Checkout Date: ${new Date().getDate()}/${new Date().getMonth() + 1}/${new Date().getFullYear()}</td>
                      </tr>
                      </table><br /><strong>Tableau de données: </strong>
                      <table width="100%" border="1" cellpadding="5" style="border: 1px solid black; border-collapse: collapse">
                      <col />
                      <colgroup span="2"></colgroup>
                      <colgroup span="2"></colgroup>
                      <tr>
                      <th rowspan="2" style="font-weight: bold;">Product</th>
                      <th colspan="3" scope="colgroup">Inventory</th>
                      <th colspan="4" scope="colgroup">Stock Consumption D-1</th>
                      <th colspan="4" scope="colgroup">Stock Consumption last 7 days</th>
                      </tr>
                      <tr>
                      <th scope="col">% discrepancy stock theorical vs real</th>
                      <th scope="col">Full stock value qty</th>
                      <th scope="col">Full stock value euro</th>
                      <th scope="col">D-1 High interval qty</th>
                      <th scope="col">D-1 Low interval qty</th>
                      <th scope="col">D-1 High interval euro</th>
                      <th scope="col">D-1 Low interval euro</th>
                      <th scope="col">7 last days high interval qty</th>
                      <th scope="col">7 last days low interval qty</th>
                      <th scope="col">7 last days high interval euro</th>
                      <th scope="col">7 last days low interval euro</th>
                      </tr>
                      ${dataTable.join('\n')}
                      ${totalRow}
                      </table>
                      </html>`,
          };
          await smtpTransport.sendMail(mailOptions);
        } catch (e) {
          console.error('error loop', e);
        }
      });

      return res.json(apiResponse({
        message: 'Envoyer un e-mail avec succès',
      }));
    } catch (error) {
      next(error);
    }
  },

};
