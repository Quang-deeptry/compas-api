const createSlug = require('speakingurl');
const moment = require('moment-timezone');
const { ObjectId } = require('mongoose').Types;
const {
  Products,
  Users,
  ProductPackages,
  UserScanProduct,
  UserCheckScanProduct,
  UserManualChangeStatus,
  ProductCodes,
  Media,
  IndexProducts,
} = require('../../../../models');
const {
  apiErrors,
  apiResponse,
  fuzzySearch,
  asyncForEach,
  countNumberOfCodes,
  delay,
  countQuantity,
} = require('../../../../helpers');
const {
  ITEM_PER_PAGE,
  PRODUCT_PACKAGE_STATUS,
  PRODUCT_STATUS,
  MEDIA_STATUS,
  LIST_ROLE,
} = require('../../../../constants');

const { s3 } = require('../../../../services/s3');

module.exports = {
  getProductPackageInfo: async (req, res, next) => {
    try {
      const { id } = req.params;

      const productPackages = await ProductPackages.findById(id)
        .populate({
          path: 'images',
          populate: {
            path: 'productCodeImages invoiceImages',
            select: '_id type image',
          },
        })
        .lean();

      if (!productPackages) return next(apiErrors.productPackageNotFound);

      await ProductPackages.populate(productPackages, { path: 'products' });

      return res.json(apiResponse({
        message: 'Obtenez des produits dans le succès du package de produits',
        payload: productPackages,
      }));
    } catch (error) {
      next(error);
    }
  },

  getProductInProductPackage: async (req, res, next) => {
    try {
      const { id } = req.params;
      let isEditPackage = true;
      const checkItem = [];

      const productPackages = await ProductPackages.findById(id)
        .populate({
          path: 'images',
          populate: {
            path: 'productCodeImages invoiceImages',
            select: '_id type image',
          },
        })
        .populate({
          path: 'products',
          populate: {
            path: 'mergeIndexProduct',
            select: 'converter title slug sku',
          },
        })
        .lean();

      if (!productPackages) return next(apiErrors.productPackageNotFound);

      const listUsingProduct = await ProductCodes.find(
        {
          productPackage: id,
          $or: [
            { status: PRODUCT_STATUS.OPEN },
            { status: PRODUCT_STATUS.EMPTY },
          ],
        },
      ).lean();

      for (let i = 0; i < productPackages.products.length; i += 1) {
        const checkList = await ProductCodes.find(
          {
            product: productPackages.products[i]._id,
            $or: [
              { status: PRODUCT_STATUS.OPEN },
              { status: PRODUCT_STATUS.EMPTY },
            ],
          },
        ).lean();

        checkItem.push({
          isEditProduct: checkList.length === 0,
          _id: productPackages.products[i]._id,
        });
      }

      if (listUsingProduct.length > 0) isEditPackage = false;

      const listUpdateProduct = productPackages.products.map(
        (item, i) => (
          {
            ...item,
            ...checkItem[i],
          }
        ),
      );

      return res.json(apiResponse({
        message: 'Obtenez des produits dans le succès du package de produits',
        payload: {
          ...productPackages,
          products: listUpdateProduct,
          isEditPackage,
        },
      }));
    } catch (error) {
      next(error);
    }
  },

  getProductPackageList: async (req, res, next) => {
    try {
      const {
        user: { id },
        query: {
          q,
          orderCode,
          quantity,
          totalPrice,
          startDeliveryScheduled,
          endDeliveryScheduled,
          startReceivedDate,
          endReceivedDate,
          isReception,
          sort,
          page,
        },
      } = req;
      let reception;

      if (isReception && isReception === 'true') {
        // reception = isReception && isReception ? true : false;
        reception = !!(isReception && isReception);
      }

      const user = await Users.findById(id).lean();

      const currentPage = Math.ceil((!page || page <= 0) ? 1 : +page);
      const conditionSort = {};
      const conditionFind = {
        status: reception ? PRODUCT_PACKAGE_STATUS.RECEPTION : PRODUCT_PACKAGE_STATUS.RESERVOIR,
        restaurant: { $in: user.restaurants },
      };

      if (q) conditionFind.provider = fuzzySearch(q);
      if (orderCode) conditionFind.orderCode = fuzzySearch(orderCode);
      if (quantity) conditionFind.quantity = Number(quantity);
      if (totalPrice) conditionFind.totalPrice = Number(totalPrice);

      if (startDeliveryScheduled && endDeliveryScheduled) {
        conditionFind.deliveryScheduled = {
          $gte: new Date(moment.utc(startDeliveryScheduled).startOf('day')),
          $lte: new Date(moment.utc(startDeliveryScheduled).endOf('day')),
        };
      } else if (startDeliveryScheduled) {
        conditionFind.deliveryScheduled = {
          $gte: new Date(moment.utc(startDeliveryScheduled).startOf('day')),
          $lte: new Date(moment.utc().endOf('day')),
        };
      } else if (endDeliveryScheduled) {
        conditionFind.deliveryScheduled = {
          $gte: new Date(moment.utc().startOf('day')),
          $lte: new Date(moment.utc(endDeliveryScheduled).endOf('day')),
        };
      }

      if (startReceivedDate && endReceivedDate) {
        conditionFind.receivedDate = {
          $gte: new Date(moment.utc(startReceivedDate).startOf('day')),
          $lte: new Date(moment.utc(endReceivedDate).endOf('day')),
        };
      } else if (startReceivedDate) {
        conditionFind.receivedDate = {
          $gte: new Date(moment.utc(startReceivedDate).startOf('day')),
          $lte: new Date(moment.utc().endOf('day')),
        };
      } else if (endReceivedDate) {
        conditionFind.receivedDate = {
          $gte: new Date(moment.utc().startOf('day')),
          $lte: new Date(moment.utc(endReceivedDate).endOf('day')),
        };
      }

      switch (Number(sort)) {
        case 2:
          conditionSort.createdAt = 1;
          break;
        case 3:
          conditionSort.provider = 1;
          break;
        case 4:
          conditionSort.orderCode = 1;
          break;
        case 5:
          conditionSort.deliveryScheduled = 1;
          break;
        case 6:
          conditionSort.receivedDate = 1;
          break;
        default:
          conditionSort.createdAt = -1;
      }

      const productPackages = await ProductPackages.find(conditionFind)
        .populate({
          path: 'products',
          match: null,
          select: 'tariffs totalPrice',
        })
        .populate({
          path: 'images',
          populate: {
            path: 'productCodeImages invoiceImages',
          },
        })
        .sort(conditionSort)
        .skip(ITEM_PER_PAGE * (currentPage - 1))
        .limit(ITEM_PER_PAGE)
        .lean();

      return res.json(apiResponse({
        message: 'Obtenez le succès du package de produits',
        payload: productPackages,
      }));
    } catch (error) {
      next(error);
    }
  },
  manualCreatedProductPackage: async (req, res, next) => {
    try {
      const {
        user: { id },
        body: {
          provider,
          orderCode,
          deliveryScheduled,
          receivedDate,
          status,
        },
      } = req;

      const user = await Users.findById(id).lean();
      if (!user) return next(apiErrors.userNotFound);
      if (user.restaurants.length < 1) return next(apiErrors.restaurantNotFound);

      if (status === PRODUCT_PACKAGE_STATUS.RECEPTION) {
        const deliveryScheduledTimeStamp = moment(deliveryScheduled).toDate().valueOf();
        const receivedDateTimeStamp = moment(receivedDate).toDate().valueOf();
        const now = moment(new Date()).toDate().valueOf();
        if (now < receivedDateTimeStamp || receivedDateTimeStamp < deliveryScheduledTimeStamp) {
          return next(apiErrors.timeInvalid);
        }
      }

      const updateData = {
        provider,
        orderCode,
        deliveryScheduled,
        status,
        receivedDate: status === PRODUCT_PACKAGE_STATUS.RECEPTION ? receivedDate : null,
        user: id,
        restaurant: user.restaurants[0],
      };

      const newPackage = await ProductPackages.create(updateData);

      return res.json(apiResponse({
        message: 'Package de produit créé avec succès',
        payload: newPackage,
      }));
    } catch (error) {
      next(error);
    }
  },

  manualCreatedProduct: async (req, res, next) => {
    try {
      const {
        user: { id },
        params: { id: productPackageId },
        body: {
          sku,
          title,
          tariffs: {
            unit: tariffsUnit,
            price: tariffsPrice,
          },
          converter,
          expDate,
          unit,
          quantity,
        },
      } = req;

      if (typeof (tariffsPrice) !== 'number' || typeof (quantity) !== 'number') {
        return next(apiErrors.isNotANumber);
      }
      const totalPrice = +(tariffsPrice * quantity).toFixed(2);

      const user = await Users.findById(id).lean();
      if (!user) return next(apiErrors.userNotFound);

      const productPackage = await ProductPackages.findById(productPackageId)
        .populate({
          path: 'products',
          select: 'sku',
        }).lean();
      if (!productPackage) return next(apiErrors.productPackageNotFound);

      if (productPackage.products.some((item) => item.sku === sku)) {
        return next(apiErrors.skuIsExist);
      }

      const listProduct = productPackage.products;

      const productData = {
        sku: sku || '',
        title,
        tariffs: {
          unit: tariffsUnit,
          price: tariffsPrice,
        },
        converter,
        expDate: expDate || null,
        unit,
        quantity,
        totalPrice,
        user: id,
        restaurant: productPackage.restaurant,
        productPackage: productPackage._id,
        mergeIndexProduct: null,
        slug: createSlug(title),
        receivedDate: productPackage.status === PRODUCT_PACKAGE_STATUS.RECEPTION
          ? new Date() : null,
        status: productPackage.status === PRODUCT_PACKAGE_STATUS.RECEPTION
          ? PRODUCT_STATUS.FULL : PRODUCT_STATUS.INCOMING,
      };

      const checkProductNameAndSku = await IndexProducts
        .findOne({
          oldTitle: title,
          sku,
        }).select('_id title converter quantity').lean();

      const checkProductSku = await IndexProducts
        .findOne({
          sku,
        }).select('_id title converter quantity').lean();

      if (checkProductNameAndSku) {
        productData.referenceProduct = checkProductNameAndSku._id;
      } else if (checkProductSku) {
        productData.mergeIndexProduct = checkProductSku._id;
      }

      if (!checkProductNameAndSku) {
        const newIndexProduct = await IndexProducts.create({
          title,
          oldTitle: title,
          slug: createSlug(title),
          sku,
          provider: productPackage.provider,
          restaurant: productPackage.restaurant,
          productPackage: productPackage._id,
        });
        productData.referenceProduct = newIndexProduct._id;
      }

      // Tạo sản phẩm
      const product = await Products.create(productData);
      listProduct.push(product._id);

      await ProductPackages.findByIdAndUpdate(
        productPackageId,
        {
          products: listProduct,
          $inc: { totalPrice: Number(totalPrice), quantity: 1 },
        },
      );

      // Tạo codes cho sản phẩm
      let j = 0;
      const numberOfCodes = await countNumberOfCodes(converter, quantity);
      const productCodeQuantity = await countQuantity(quantity, numberOfCodes);
      for (j; j < numberOfCodes; j += 1) {
        await ProductCodes.create({
          quantity: productCodeQuantity,
          totalPrice: totalPrice / numberOfCodes,
          productPackage: productPackage._id,
          product: product._id,
          user: id,
          restaurant: product.restaurant,
          title: product.title,
          slug: createSlug(product.title),
          tariffs: {
            unit: product.tariffs.unit,
            price: product.tariffs.price,
          },
          unit: product.unit,
          sku: product.sku,
          referenceProduct: product.referenceProduct,
        });
        await delay(50);
      }

      return res.json(apiResponse({
        message: 'Produit créé avec succès',
        payload: product,
      }));
    } catch (error) {
      next(error);
    }
  },
  updateProductPackage: async (req, res, next) => {
    try {
      const {
        user: { id },
        body: {
          provider,
          orderCode,
          deliveryScheduled,
          receivedDate,
          status,
        },
        params: { id: packageId },
      } = req;

      const user = await Users.findById(id).lean();
      if (!user) return next(apiErrors.userNotFound);
      if (user.restaurants.length < 1) return next(apiErrors.restaurantNotFound);

      const productPackage = ProductPackages.findById(packageId);
      if (!productPackage) return next(apiErrors.productPackageNotFound);

      const listCheckCode = ProductCodes.find(
        {
          productPackage: packageId,
          $or: [
            { status: PRODUCT_STATUS.OPEN },
            { status: PRODUCT_STATUS.EMPTY },
          ],
        },
      ).lean();

      if (listCheckCode.length > 0) return next(apiErrors.canNotUUpdatePackage);

      if (status === PRODUCT_PACKAGE_STATUS.RECEPTION) {
        const deliveryScheduledTimeStamp = moment(deliveryScheduled).toDate().valueOf();
        const receivedDateTimeStamp = moment(receivedDate).toDate().valueOf();
        const now = moment(new Date()).toDate().valueOf();
        if (now < receivedDateTimeStamp || receivedDateTimeStamp < deliveryScheduledTimeStamp) {
          return next(apiErrors.timeInvalid);
        }
      }

      const updateData = {
        provider,
        orderCode,
        deliveryScheduled,
        receivedDate: status === PRODUCT_PACKAGE_STATUS.RECEPTION ? receivedDate : null,
        status,
      };

      const newPackage = await ProductPackages.findByIdAndUpdate(
        packageId,
        { $set: { ...updateData } },
        { new: true },
      );

      return res.json(apiResponse({
        message: 'Mettre à jour le package du produit avec succès',
        payload: newPackage,
      }));
    } catch (error) {
      next(error);
    }
  },
  deleteProductPackage: async (req, res, next) => {
    try {
      const {
        params: { id },
        user: { id: userId },
      } = req;
      const deleteMediaId = [];
      const paramsKey = [];

      const checkUser = await Users.findById(userId).select('role').lean();
      if (checkUser.role !== LIST_ROLE.OWNER) return next(apiErrors.badRequest);

      const checkProductPackage = await ProductPackages
        .findOne({
          _id: id,
          user: checkUser._id,
        })
        .populate({
          path: 'images',
          populate: {
            path: 'productCodeImages invoiceImages',
            select: '_id image',
          },
        })
        .populate({
          path: 'products',
          select: 'referenceProduct',
        })
        .select('user products')
        .lean();

      if (!checkProductPackage) return next(apiErrors.badRequest);

      await asyncForEach(checkProductPackage.images.productCodeImages, (item) => {
        deleteMediaId.push(item);
        const key = item.image.split('/');
        paramsKey.push({ Key: `${key[3]}/${key[4]}/${key[5]}` });
      });

      await asyncForEach(checkProductPackage.images.invoiceImages, (item) => {
        deleteMediaId.push(item);
        const key = item.image.split('/');
        paramsKey.push({ Key: `${key[3]}/${key[4]}/${key[5]}` });
      });

      const deleteParam = {
        Bucket: process.env.AWS_BUCKET,
        Delete: {
          Objects: paramsKey,
        },
      };

      s3.deleteObjects(deleteParam, (err) => {
        if (err) return next(apiErrors.notFound);
      });

      await ProductPackages.findByIdAndDelete(id);
      await Products.deleteMany({ productPackage: id });
      await ProductCodes.deleteMany({ productPackage: id });

      await Media.deleteMany({ _id: { $in: deleteMediaId } });

      await UserScanProduct.deleteMany({ productPackage: id });
      await UserCheckScanProduct.deleteMany({ productPackage: id });
      await UserManualChangeStatus.deleteMany({ productPackage: id });

      if (checkProductPackage.products.length > 0) {
        // Check if any products refer to that indexProduct
        checkProductPackage.products.forEach(async (p) => {
          const checkRefProduct = await Products
            .findOne({
              referenceProduct: p.referenceProduct,
            })
            .lean();
          if (!checkRefProduct) {
            await IndexProducts.findByIdAndDelete(p.referenceProduct);
          }
        });
      }

      res.json(apiResponse({
        message: 'Suppression du package de produit réussie',
      }));
    } catch (error) {
      next(error);
    }
  },

  onPrintCodeInProductPackage: async (req, res, next) => {
    try {
      const {
        params: { id: productPackageId },
        body: { products },
      } = req;

      // kiểm tra productPackage có tồn tại
      const productPackage = await ProductPackages.findById(productPackageId);
      if (!productPackage) return next(apiErrors.productPackageNotFound);
      // kiểm tra thùng hàng đã nhận mới được in mã.
      if (productPackage.status
        === PRODUCT_PACKAGE_STATUS.RESERVOIR) return next(apiErrors.productPackageWasNotScan);

      if (products && products.length > 0) {
        const listPromises = [];
        const listProductCodes = [];

        for (let i = 0; i < products.length; i += 1) {
          listPromises[i] = ProductCodes
            .find({ product: products[i] }, (err, doc) => {
              if (err) return next(apiErrors.badRequest);
              listProductCodes.push(doc);
            });
        }
        await Promise.all(listPromises);

        return res.json(apiResponse({
          message: 'Obtenez le succès des codes produits',
          payload: listProductCodes,
        }));
      }

      const listCode = await ProductCodes.find({ productPackage: productPackageId }).lean();
      if (!listCode) return next(apiErrors.codeNotFound);

      return res.json(apiResponse({
        message: 'Obtenez le succès des codes produits',
        payload: listCode,
      }));
    } catch (error) {
      next(error);
    }
  },

  onUpdateProductImages: async (req, res, next) => {
    try {
      const {
        params: { id },
        body: { type },
        user: { id: userId },
      } = req;
      const imageForDelete = [];
      let newProduct = {};
      let packageUpdate = {};

      const userData = await Users.findById(userId).select('restaurants role').lean();

      if (userData.role === !LIST_ROLE.OWNER) return next(apiErrors.badRequest);

      const productPackage = await ProductPackages.findOne({
        _id: id,
        user: userData._id,
      })
        .lean();

      if (!productPackage) return next(apiErrors.productPackageNotFound);

      if (req.files === undefined && typeof req.files !== 'object') return next(apiErrors.badRequest);

      const images = [];
      if (req.files.images) {
        switch (type) {
          case MEDIA_STATUS.PRODUCT_CODE_IMAGES:
            await asyncForEach(req.files.images, async (item) => {
              const media = await Media.create({
                productPackages: id,
                image: item.transforms[0].location,
                type: MEDIA_STATUS.PRODUCT_CODE_IMAGES,
              });
              images.push(media._id);
            });
            images.push(...productPackage.images.productCodeImages);
            newProduct = { 'images.productCodeImages': images };
            break;
          case MEDIA_STATUS.INVOICE_IMAGES:
            await asyncForEach(req.files.images, async (item) => {
              const media = await Media.create({
                productPackages: id,
                image: item.transforms[0].location,
                type: MEDIA_STATUS.INVOICE_IMAGES,
              });
              images.push(media._id);
            });
            images.push(...productPackage.images.invoiceImages);
            newProduct = { 'images.invoiceImages': images };
            break;
          default:
            return next(apiErrors.badRequest);
        }

        if (productPackage.status === PRODUCT_PACKAGE_STATUS.RESERVOIR) {
          // cập nhập status của mã code của sản phẩm
          await ProductCodes.updateMany(
            {
              productPackage: productPackage._id,
              status: PRODUCT_STATUS.INCOMING,
            },
            {
              receivedDate: new Date(),
              status: PRODUCT_STATUS.FULL,
            },
          );

          // cập nhập status của sản phẩm
          await Products.updateMany(
            {
              productPackage: productPackage._id,
              status: PRODUCT_STATUS.INCOMING,
            },
            {
              receivedDate: new Date(),
              status: PRODUCT_STATUS.FULL,
            },
          );

          await ProductPackages.findByIdAndUpdate(
            id,
            {
              receivedDate: new Date(),
              status: PRODUCT_PACKAGE_STATUS.RECEPTION,
              user: userId,
              ...newProduct,
            },
            { new: true },
          );

          packageUpdate = {
            receivedDate: new Date(),
            status: PRODUCT_PACKAGE_STATUS.RECEPTION,
            user: userId,
          };
        }

        await ProductPackages.findByIdAndUpdate(
          id,
          {
            ...packageUpdate,
            ...newProduct,
          },
          { new: true },
        );
      }

      return res.json(apiResponse({
        message: 'Mettre à jour le succès du package de produit',
      }));
    } catch (error) {
      next(error);
    }
  },

  onDeleteImages: async (req, res, next) => {
    try {
      const {
        body: { images, type },
        params: { id },
        user: { id: userId },
      } = req;
      const getImages = [];
      let isFalse = false;
      const getType = false;

      const checkProductPackage = await ProductPackages.findById(id)
        .populate({
          path: 'images',
          populate: {
            path: 'productCodeImages invoiceImages',
          },
        })
        .lean();

      if (!checkProductPackage) return next(apiErrors.notFound);

      if (!images && typeof images !== 'object' && !type) return next(apiErrors.badRequest);

      await asyncForEach(images, (image) => {
        if (!ObjectId.isValid(image)) isFalse = true;
      });

      if (isFalse) return next(apiErrors.badRequest);

      // remove in s3
      const imageForDelete = [];
      const medias = await Media.find({ _id: { $in: images } }).lean();

      if (!medias) return next(apiErrors.badRequest);

      switch (type) {
        case MEDIA_STATUS.PRODUCT_CODE_IMAGES:
          await ProductPackages.findOneAndUpdate(
            { _id: id },
            { $pull: { 'images.productCodeImages': { $in: images } } },
            { new: true },
            async (err) => {
              if (err) return console.error(err);
            },
          );

          // eslint-disable-next-line no-case-declarations
          const checkMediaPCI = await Media.find({
            _id: { $in: images },
            type: MEDIA_STATUS.PRODUCT_CODE_IMAGES,
          }).lean();

          if (!checkMediaPCI.length) return next(apiErrors.badRequest);

          await Media.deleteMany(
            { _id: { $in: images } },
            (error) => {
              if (error) return console.error(error);
            },
          );
          break;
        case MEDIA_STATUS.INVOICE_IMAGES:
          await ProductPackages.findOneAndUpdate(
            { _id: id },
            { $pull: { 'images.invoiceImages': { $in: images } } },
            { new: true },
            async (err) => {
              if (err) return console.error(err);
            },
          );

          // eslint-disable-next-line no-case-declarations
          const checkMediaII = await Media.find({
            _id: { $in: images },
            type: MEDIA_STATUS.INVOICE_IMAGES,
          }).lean();

          if (!checkMediaII.length) return next(apiErrors.badRequest);

          await Media.deleteMany(
            { _id: { $in: images } },
            (error) => {
              if (error) return console.error(error);
            },
          );
          break;
        default:
          return next(apiErrors.userIsBlocked);
      }

      await asyncForEach(medias, (media) => {
        imageForDelete.push({ Key: media.image });
      });

      const deleteParam = {
        Bucket: process.env.AWS_BUCKET,
        Delete: {
          Objects: imageForDelete,
        },
      };

      s3.deleteObjects(deleteParam, (err) => {
        if (err) return next(apiErrors.notFound);
      });

      return res.json(apiResponse({
        message: 'success',
      }));
    } catch (error) {
      next(error);
    }
  },
};
