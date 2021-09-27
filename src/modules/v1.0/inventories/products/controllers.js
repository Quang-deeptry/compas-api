const createSlug = require('speakingurl');
const moment = require('moment-timezone');
const { ObjectId } = require('mongoose').Types;

const {
  Products,
  Users,
  UserScanProduct,
  UserCheckScanProduct,
  ProductCodes,
  IndexProducts,
  UserManualChangeStatus,
  Histories,
  ProductPackages,
} = require('../../../../models');
const {
  fuzzySearch,
  apiErrors,
  apiResponse,
  countNumberOfCodes,
  countQuantity,
  delay,
} = require('../../../../helpers');
const {
  PRODUCT_STATUS,
  ITEM_PER_PAGE,
  LIST_ROLE,
  HISTORY_REF_MODEL,
} = require('../../../../constants');

// sản phẩm đang hoặc đã sử dụng không thể đổi converter
const checkedProductCodeUsing = async (list, next) => {
  if (list.some((item) => item.status === PRODUCT_STATUS.OPEN
    || item.status === PRODUCT_STATUS.EMPTY)) {
    return next(apiErrors.someProducWasUsing);
  }
};

// xóa mã codes của sản phẩm - xóa lịch sử scan - lịch sử mark scan của codes
const deleteProductCodesData = async (list, productId) => {
  if (list && list.length > 0) {
    await ProductCodes.deleteMany({ product: productId });
    let i = 0;
    const { length } = list;
    for (i; i < length; i += 1) {
      await UserScanProduct.deleteMany({ productCode: list[i] });
      await UserCheckScanProduct.deleteMany({ productCode: list[i] });
      await Histories.deleteMany({ target: list[i] });
      await UserManualChangeStatus.deleteMany({ productCode: list[i] });
    }
  }
};

module.exports = {
  onScanToUsingProductCode: async (req, res, next) => {
    try {
      const { params: { id: productCode }, user: { id: user } } = req;
      const userData = await Users.findById(user).select('restaurants');

      // Kiểm tra sản phẩm có thuộc nhà hàng mà nhân viên này làm việc?'
      const productChecked = await ProductCodes.findOne({
        _id: productCode,
        restaurant: { $in: userData.restaurants },
      }).lean();

      if (!productChecked) return next(apiErrors.productNotFound);

      // Quét sản phẩm đã được nhân viên khác quét?
      // <<start>>
      if (productChecked.status === PRODUCT_STATUS.OPEN
        || productChecked.status === PRODUCT_STATUS.EMPTY) {
        return res.json(apiResponse({
          message: 'Le produit a été utilisé, veuillez choisir un autre produit',
          payload: {
            ...productChecked,
            isSecondScan: true,
            isProduct: true,
          },
        }));
      }
      // <<end>>

      // nhân viên chỉ có thể quét để dùng sản phẩm có trang thái full
      // và chưa bị nhân viên khác quét
      if (productChecked.status === PRODUCT_STATUS.FULL) {
        // tìm kiếm xem nhân viên này có sản phẩm nào đang sử dụng không?
        const scanProduct = await UserScanProduct.find(
          { user, status: PRODUCT_STATUS.OPEN },
        );

        if (scanProduct.length > 0) { // nếu có sản phẩm đang sử dụng - xử lý sản phẩm ấy
          // cập nhập trạng thái cho sản phẩm đã quét đó sang đã sử dụng xong
          await UserScanProduct.findByIdAndUpdate(
            scanProduct[0]._id,
            { status: PRODUCT_STATUS.EMPTY },
            { new: true, sort: { createdAt: -1 } },
          );

          // kiểm tra trạng thái của sản phẩm đó trong bảng ProductCodes
          const currentProductCode = await ProductCodes.findById(scanProduct[0].productCode).lean();

          // nếu trạng thái của sản phẩm trùng khớp với trang thái của sản phẩm ấy đã quét
          // nghĩa là sản phẩm chưa bị đổi trạng thái thủ công thì mới cập nhập
          if (currentProductCode.status === scanProduct[0].status) {
            const productCodeUpdated = await ProductCodes.findByIdAndUpdate(
              scanProduct[0].productCode,
              {
                status: PRODUCT_STATUS.EMPTY,
                finishedDate: new Date(),
              },
              { new: true },
            );

            await Histories.create({
              restaurant: productCodeUpdated.restaurant,
              user: productCodeUpdated.user,
              target: productCodeUpdated._id,
              referenceModel: HISTORY_REF_MODEL.PRODUCT_CODE,
              fieldChange: 'status',
              name: productCodeUpdated.title,
              beforeValue: PRODUCT_STATUS.OPEN,
              afterValue: PRODUCT_STATUS.EMPTY,
            });
          }
        }
        // <<end>>

        const updateProductCode = await ProductCodes.findByIdAndUpdate(productCode,
          {
            status: PRODUCT_STATUS.OPEN,
            openDate: new Date(),
          },
          { new: true }).lean();

        await UserScanProduct.create({
          user,
          productCode,
          productPackage: productChecked.productPackage,
          restaurant: productChecked.restaurant,
          status: PRODUCT_STATUS.OPEN,
        });

        await Histories.create({
          restaurant: productChecked.restaurant,
          user: productChecked.user,
          target: productCode,
          referenceModel: HISTORY_REF_MODEL.PRODUCT_CODE,
          fieldChange: 'status',
          name: productChecked.title,
          beforeValue: PRODUCT_STATUS.FULL,
          afterValue: PRODUCT_STATUS.OPEN,
        });

        return res.json(apiResponse({
          message: 'Le produit utilisait',
          payload: {
            ...updateProductCode,
            isProduct: true,
          },
        }));
      }

      return next(apiErrors.productIsUnavailable);
    } catch (error) {
      next(error);
    }
  },
  onEditStatusOfProductCode: async (req, res, next) => {
    try {
      const {
        params: { id },
        user: { id: userId },
        body: {
          status,
        },
      } = req;
      const user = await Users.findById(userId).lean();
      if (!user) return next(apiErrors.userNotFound);

      if (status === PRODUCT_STATUS.INCOMING) return next(apiErrors.statusInvalid);

      // check user này có phải người scan sản phẩm trước đó không
      const checkUserScaned = await UserScanProduct.findOne({
        productCode: id,
        user: userId,
      });

      if (user.role === LIST_ROLE.EMPLOYEER
        && !checkUserScaned) return next(apiErrors.userNotHavePermision);

      const productCode = await ProductCodes.findById(id).lean();

      if (productCode.status
        === PRODUCT_STATUS.INCOMING) return next(apiErrors.userNotHavePermision);
      if (!productCode) return next(apiErrors.productNotFound);

      if (productCode.status === status) return mext(apiErrors.invalidStatus);

      if (productCode.status === PRODUCT_STATUS.FULL
        && status === PRODUCT_STATUS.EMPTY) {
        await UserManualChangeStatus.findOneAndUpdate(
          { productCode: id },
          {
            productCode: id,
            product: productCode.product,
            productPackage: productCode.productPackage,
            restaurant: productCode.restaurant,
            user: userId,
            referenceProduct: productCode.referenceProduct,
          },
          { upsert: true, new: true, setDefaultsOnInsert: true },
        );
        // cập nhập vào collection user_manual_change_status
      }

      if (status === PRODUCT_STATUS.FULL) {
        await UserScanProduct.deleteMany({ user: userId, productCode: id });
      }

      const updateInfo = { status };

      // update này tháng của các field tương ứng
      if (
        status === PRODUCT_STATUS.FULL
        || status === PRODUCT_STATUS.OPEN
        || status === PRODUCT_STATUS.EMPTY
      ) {
        if (status !== productCode.status) {
          switch (status) {
            case PRODUCT_STATUS.OPEN: {
              updateInfo.openDate = new Date();
              updateInfo.finishedDate = null;
              break;
            }
            case PRODUCT_STATUS.EMPTY: {
              updateInfo.finishedDate = new Date();
              break;
            }
            default: {
              updateInfo.receivedDate = new Date();
              updateInfo.openDate = null;
              updateInfo.finishedDate = null;
            }
          }
        }
        if (status === PRODUCT_STATUS.EMPTY
          && productCode.status === PRODUCT_STATUS.FULL) {
          updateInfo.openDate = new Date();
        }
      }

      const updateProductCodes = await ProductCodes.findByIdAndUpdate(
        id,
        { $set: { ...updateInfo } },
        { new: true },
      );

      await Histories.create({
        restaurant: updateProductCodes.restaurant,
        user: updateProductCodes.user,
        target: id,
        referenceModel: HISTORY_REF_MODEL.PRODUCT_CODE,
        fieldChange: 'status',
        name: updateProductCodes.title,
        beforeValue: productCode.status,
        afterValue: status,
        isAuto: false,
      });

      return res.json(apiResponse({
        message: 'Mise à jour du code produit réussie',
        payload: updateProductCodes,
      }));
    } catch (error) {
      next(error);
    }
  },

  onViewDetailOfProductCode: async (req, res, next) => {
    try {
      const {
        params: { id },
      } = req;

      const productCode = await ProductCodes.findById(id)
        .populate({
          path: 'productPackage',
          select: 'images',
          populate: {
            path: 'images',
            populate: {
              path: 'productCodeImages invoiceImages',
              select: 'image type',
            },
          },
        })
        .lean();
      if (!productCode) return next(apiErrors.productNotFound);

      return res.json(apiResponse({
        message: 'Obtenez le succès du code produit',
        payload: productCode,
      }));
    } catch (error) {
      next(error);
    }
  },

  // Cần role Owner - Manager để truy cập: checkPermission

  onGetSuggestionProduct: async (req, res, next) => {
    try {
      const {
        query: {
          title,
          sku,
        },
        user: { id },
      } = req;
      const user = await Users.findById(id).select('restaurants').lean();
      const conditionFind = {
        restaurant: { $in: user.restaurants },
      };

      if (title) conditionFind.title = fuzzySearch(title);
      if (sku) conditionFind.title = sku;

      const listProduct = await IndexProducts.find(conditionFind).lean();

      return res.json(apiResponse({
        message: 'Obtenez le succès de la suggestion de produit de la liste',
        payload: listProduct,
      }));
    } catch (error) {
      next(error);
    }
  },

  onPrintCodesOfProduct: async (req, res, next) => { // API has been remove
    try {
      const { params: { id } } = req;
      const listCode = await ProductCodes.find({ product: id }).lean();
      const total = await ProductCodes.countDocuments({ product: id }).lean();
      if (!listCode) return next(apiErrors.codeNotFound);

      return res.json(apiResponse({
        message: 'Obtenez le succès des codes produits',
        total,
        payload: listCode,
      }));
    } catch (error) {
      next(error);
    }
  },
  onUpdateProduct: async (req, res, next) => {
    try {
      const {
        body: {
          converter,
          title,
          sku,
          tariffsUnit,
          tariffsPrice,
          expDate,
          unit,
          quantity,
          totalPrice,
        },
        user: { id },
        params: { id: productId },
      } = req;
      let newStatus = PRODUCT_STATUS.INCOMING;
      let updateProductData = {};
      let updateProductCodeData = {};
      const updateIndexProductData = {};
      const updatePackageData = {};

      const product = await Products.findById(productId).lean();
      if (!product) return next(apiErrors.productNotFound);

      if (converter || Number(converter) === 0) {
        if (typeof converter !== 'number') return next(apiErrors.isNotANumber);
        if (Number(converter) < 0 || Number(converter) === 0) {
          return next(apiErrors.converterInvalid);
        }

        // lấy danh sách codes của sản phẩm
        const listProductCode = await ProductCodes.find({ product: productId }).select('_id status');

        await checkedProductCodeUsing(listProductCode, next);

        // sản phẩm chưa sử dụng có thể đổi converter
        if (listProductCode.every((item) => item.status === PRODUCT_STATUS.FULL)) {
          newStatus = PRODUCT_STATUS.FULL;
        }
        await deleteProductCodesData(listProductCode, productId);

        const numberOfCodes = await countNumberOfCodes(converter, product.quantity);
        const quantityUpdate = await countQuantity(product.quantity, numberOfCodes);

        // tạo codes mới cho sản phẩm
        let j = 0;
        for (j; j < numberOfCodes; j += 1) {
          await ProductCodes.create({
            user: id,
            restaurant: product.restaurant,
            productPackage: product.productPackage,
            product: product._id,
            title: product.title,
            slug: createSlug(product.title),
            tariffs: {
              unit: product.tariffs.unit,
              price: product.tariffs.price,
            },
            quantity: quantityUpdate,
            status: newStatus,
            unit: product.unit,
            totalPrice: product.totalPrice / numberOfCodes,
            sku: product.sku,
            expDate: product.expDate || null,
            receivedDate: product.receivedDate || null,
            referenceProduct: product.referenceProduct,
          });
          await delay(50);
        }
        const update = { converter: Number(converter) };
        const productUpdate = await Products.findByIdAndUpdate(
          productId,
          { $set: { ...update } },
          { new: true },
        ).lean();

        // cập nhập sản phẩm tham chiếu của sản phẩm
        await IndexProducts.findByIdAndUpdate(
          product.referenceProduct,
          { $set: { ...update } },
          { new: true },
        ).lean();

        return res.json(apiResponse({
          message: 'Convertisseur de mise à jour du succès du produit',
          payload: productUpdate,
        }));
      }
      if (title) {
        updateProductData.title = title;
        updateProductData.slug = createSlug(title);

        updateProductCodeData.title = title;
        updateProductCodeData.slug = createSlug(title);

        updateIndexProductData.title = title;
        updateIndexProductData.slug = createSlug(title);
      }
      if (tariffsUnit) {
        updateProductData = {
          tariffs: {
            unit: tariffsUnit,
            price: product.tariffs.price,
          },
        };
        updateProductCodeData = {
          tariffs: {
            unit: tariffsUnit,
            price: product.tariffs.price,
          },
        };
      }
      if (tariffsPrice) {
        if (typeof tariffsPrice !== 'number') return next(apiErrors.isNotANumber);
        updateProductData = {
          tariffs: {
            unit: product.tariffs.unit,
            price: tariffsPrice,
          },
        };
        updateProductCodeData = {
          tariffs: {
            unit: product.tariffs.unit,
            price: tariffsPrice,
          },
        };
      }
      if (expDate) {
        updateProductData.expDate = expDate;
        updateProductCodeData.expDate = expDate;
      }
      if (unit) {
        updateProductData.unit = unit;
        updateProductCodeData.unit = unit;
      }
      if (quantity) {
        if (typeof quantity !== 'number') return next(apiErrors.isNotANumber);
        const listProductCode = await ProductCodes.find({ product: productId }).select('_id');

        await checkedProductCodeUsing(listProductCode, next);
        await deleteProductCodesData(listProductCode, productId);

        const numberOfCodes = await countNumberOfCodes(product.converter, quantity);
        const quantityUpdate = await countQuantity(quantity, numberOfCodes);
        let k = 0;

        for (k; k < numberOfCodes; k += 1) {
          await ProductCodes.create({
            user: id,
            restaurant: product.restaurant,
            productPackage: product.productPackage,
            product: product._id,
            title: product.title,
            slug: createSlug(product.title),
            tariffs: {
              unit: product.tariffs.unit,
              price: product.tariffs.price,
            },
            quantity: quantityUpdate,
            status: product.status,
            unit: product.unit,
            totalPrice: product.totalPrice / numberOfCodes,
            sku: product.sku,
            expDate: product.expDate || null,
            receivedDate: product.receivedDate || null,
            referenceProduct: product.referenceProduct,
          });
          await delay(50);
        }

        updateProductData.quantity = quantity;
      }
      if (totalPrice) {
        if (typeof totalPrice !== 'number') return next(apiErrors.isNotANumber);
        const packageData = await ProductPackages.findById(product.productPackage).lean();
        const numberOfCodes = await countNumberOfCodes(product.converter, product.quantity);
        updateProductData.totalPrice = totalPrice;
        updateProductCodeData.totalPrice = totalPrice / numberOfCodes;
        updatePackageData.totalPrice = packageData.totalPrice - product.totalPrice + totalPrice;
      }
      if (sku) {
        const productPackage = await ProductPackages.findById(product.productPackage)
          .populate({
            path: 'products',
            select: 'sku',
          }).lean();
        if (productPackage.products.some((item) => item.sku === sku)) {
          return next(apiErrors.skuIsExist);
        }

        const checkProductSku = await IndexProducts.findOne({ sku }).select('_id title slug converter quantity').lean();
        const listProductCode = await ProductCodes.find({ product: productId }).select('_id'); // lấy danh sách codes của sản phẩm

        if (checkProductSku // nếu đổi thành sku đã có trong hệ thống
          && product.referenceProduct.toString() !== checkProductSku._id.toString()) {
          updateProductCodeData.referenceProduct = checkProductSku._id;
          updateProductCodeData.sku = sku;
          updateProductCodeData.title = checkProductSku.title;
          updateProductCodeData.slug = checkProductSku.slug;

          updateProductData.converter = checkProductSku.converter;
          updateProductData.referenceProduct = checkProductSku._id;
          updateProductData.sku = sku;
          updateProductData.title = checkProductSku.title;
          updateProductData.slug = checkProductSku.slug;

          // nếu converter của index khác của sản phẩm
          if (checkProductSku.converter !== product.converter) {
            await deleteProductCodesData(listProductCode, productId);

            const numberOfCodes = await countNumberOfCodes(
              checkProductSku.converter, product.quantity,
            );
            const quantityUpdate = await countQuantity(product.quantity, numberOfCodes);
            let k = 0;

            for (k; k < numberOfCodes; k += 1) {
              await ProductCodes.create({
                user: id,
                restaurant: product.restaurant,
                productPackage: product.productPackage,
                product: product._id,
                title: checkProductSku.title,
                slug: checkProductSku.slug,
                tariffs: {
                  unit: product.tariffs.unit,
                  price: product.tariffs.price,
                },
                quantity: quantityUpdate,
                status: product.status,
                unit: product.unit,
                totalPrice: product.totalPrice / numberOfCodes,
                sku,
                expDate: product.expDate || null,
                receivedDate: product.receivedDate || null,
                referenceProduct: checkProductSku._id,
              });
              await delay(50);
            }
          }
          // kiểm tra còn sản phẩm nào tham chiếu đến index này ngoài sp hiện tại
          const checkReferenceProduct = await Products
            .find({ referenceProduct: product.referenceProduct }).lean();

          if (checkReferenceProduct.length === 1) {
            await IndexProducts.findByIdAndDelete(product.referenceProduct);
          }
        } else { // nếu SKU mới, kiểm tra có mấy sản phẩm ref đến index hiện tại
          const checkReferenceProduct = await Products
            .find({ referenceProduct: product.referenceProduct }).lean();

          if (checkReferenceProduct.length > 1) { // nhiều hơn 1 sản phẩm hiện tại thì tạo mới index
            const newIndexProduct = await IndexProducts.create({
              title: product.title,
              oldTitle: product.title,
              slug: createSlug(product.title),
              sku,
              converter: product.converter,
              provider: product.provider,
              restaurant: product.restaurant,
              productPackage: product.productPackage,
            });
            updateProductData.referenceProduct = newIndexProduct._id;
            updateProductData.sku = sku;

            updateProductCodeData.referenceProduct = newIndexProduct._id;
            updateProductCodeData.sku = sku;
          } else if (checkReferenceProduct.length === 1) { // nếu chỉ có một sản phẩm thì update sku
            // không cần update referenceProduct
            await IndexProducts.findByIdAndUpdate(product.referenceProduct, { sku });
            updateProductData.sku = sku;
            updateProductCodeData.sku = sku;
          }
        }
      }

      if (updatePackageData) {
        await ProductPackages.updateOne(
          { _id: product.productPackage },
          { $set: { ...updatePackageData } },
        );
      }

      if (updateProductCodeData) { // cập nhập code sản phẩm
        await ProductCodes.updateMany(
          { product: productId },
          { $set: { ...updateProductCodeData } },
        );
      }

      if (updateIndexProductData) { // cập nhập sản phẩm tham chiếu của sản phẩm
        await IndexProducts.findByIdAndUpdate(
          product.referenceProduct,
          { $set: { ...updateIndexProductData } },
        );
      }

      const productUpdate = await Products.findByIdAndUpdate( // cập nhập sản phẩm
        productId,
        { $set: { ...updateProductData } },
        { new: true },
      ).lean();

      return res.json(apiResponse({
        message: 'Mettre à jour le titre du succès du produit',
        payload: productUpdate,
      }));
    } catch (error) {
      next(error);
    }
  },

  listAllProductCode: async (req, res, next) => {
    try {
      const {
        query: {
          q,
          sort,
          page,
          status,
          receivedDate,
          openDate,
          finishedDate,
          isScanned,
          packageId,
          limit,
        },
        user: { id },
      } = req;

      const user = await Users.findById(id).lean();
      const currentPage = Math.ceil((!page || page <= 0) ? 1 : +page);
      const conditionSort = { updatedAt: -1 };
      const conditionFind = {
        restaurant: { $in: user.restaurants },
      };
      const conditionFindLookupTable = {};

      if (q) conditionFind.title = fuzzySearch(q);

      if (packageId) conditionFind.productPackage = ObjectId(packageId);

      if (receivedDate) {
        conditionFind.receivedDate = {
          $gte: new Date(moment.utc(receivedDate).startOf('day')),
          $lte: new Date(moment.utc(receivedDate).endOf('day')),
        };
      }

      if (openDate) {
        conditionFind.openDate = {
          $gte: new Date(moment.utc(openDate).startOf('day')),
          $lte: new Date(moment.utc(openDate).endOf('day')),
        };
      }

      if (finishedDate) {
        conditionFind.finishedDate = {
          $gte: new Date(moment.utc(finishedDate).startOf('day')),
          $lte: new Date(moment.utc(finishedDate).endOf('day')),
        };
      }

      if (status) {
        const statusArr = status.split('|');
        conditionFind.status = {
          $in: statusArr,
        };
      }

      switch (Number(sort)) {
        case 2:
          conditionSort.sku = -1;
          break;
        case 3:
          conditionSort.updatedAt = 1;
          break;
        case 4:
          conditionSort.receivedDate = -1;
          break;
        case 5:
          conditionSort.openDate = -1;
          break;
        case 6:
          conditionSort.finishedDate = -1;
          break;
        default:
          conditionSort.updatedAt = -1;
      }

      if (+isScanned === 1) {
        conditionFindLookupTable.checkScanProduct = {
          $gt: [],
        };
      } else if (+isScanned === 0) {
        conditionFindLookupTable.checkScanProduct = {
          $exists: true,
          $eq: [],
        };
      }

      const skipPerPage = limit ? limit * (currentPage - 1) : ITEM_PER_PAGE * (currentPage - 1);
      const limitPerPage = Number(limit) || ITEM_PER_PAGE;

      const productCodes = await ProductCodes
        .aggregate()
        .match(conditionFind)
        .lookup({
          from: 'user_check_scan_products',
          localField: '_id',
          foreignField: 'productCode',
          as: 'checkScanProduct',
        })
        // .unwind({
        //   path: '$checkScanProduct',
        //   preserveNullAndEmptyArrays: true,
        // })
        .match(conditionFindLookupTable)
        .sort(conditionSort)
        .skip(skipPerPage)
        .limit(limitPerPage)
        .project({
          _id: 1,
          status: 1,
          title: 1,
          slug: 1,
          sku: 1,
          receivedDate: 1,
          openDate: 1,
          finishedDate: 1,
          expDate: 1,
          checkScanProduct: {
            _id: 1,
          },
        });

      const count = await ProductCodes
        .aggregate()
        .match(conditionFind)
        .lookup({
          from: 'user_check_scan_products',
          localField: '_id',
          foreignField: 'productCode',
          as: 'checkScanProduct',
        })
        .match(conditionFindLookupTable)
        .count('total');

      return res.json(apiResponse({
        message: 'Obtenez tous les succès du code produit',
        total: count.length > 0 ? count[0].total : 0,
        payload: productCodes,
      }));
    } catch (error) {
      next(error);
    }
  },

  onScanToFindProductCode: async (req, res, next) => {
    try {
      const {
        params: { id },
        user: { id: user },
      } = req;

      const productCode = await ProductCodes.findById(id).lean();
      if (!productCode) return next(apiErrors.productNotFound);

      const checked = await UserCheckScanProduct.findOne({ productCode: id });
      if (!checked) {
        await UserCheckScanProduct.create({
          user,
          productCode: id,
          restaurant: productCode.restaurant,
          productPackage: productCode.productPackage,
        });
      }
      const conditionFind = { _id: ObjectId(id) };

      const productCodeUpdate = await ProductCodes
        .aggregate()
        .match(conditionFind)
        .lookup({
          from: 'user_check_scan_products', // <collection to join>,
          localField: '_id', // <field from the input documents 'ProductCodes'>,
          foreignField: 'productCode', // <field from the documents of the "from" collection>,
          as: 'checkScanProduct', // <output array field>
        })
        // .unwind({
        //   path: '$checkScanProduct',
        //   preserveNullAndEmptyArrays: true,
        // })
        .lookup({
          from: 'product_packages', // <collection to join>,
          localField: 'productPackage', // <field from the input documents 'ProductCodes'>,
          foreignField: '_id', // <field from the documents of the "from" collection>,
          as: 'productPackage', // <output array field>
        })
        .unwind({
          path: '$productPackage',
          preserveNullAndEmptyArrays: true,
        })
        .project({
          _id: 1,
          status: 1,
          title: 1,
          slug: 1,
          sku: 1,
          receivedDate: 1,
          openDate: 1,
          checkScanProduct: {
            _id: 1,
          },
          productPackage: {
            _id: 1,
            user: 1,
            restaurant: 1,
            deliveryScheduled: 1,
            receivedDate: 1,
            provider: 1,
          },
        });

      return res.json(apiResponse({
        message: 'Obtenez le succès du code produit',
        payload: productCodeUpdate,
      }));
    } catch (error) {
      next(error);
    }
  },

  onToggleCheckScanProductCode: async (req, res, next) => {
    try {
      const {
        params: { id },
        user: { id: user },
        query: { isCheck },
      } = req;
      const productCode = await ProductCodes.findById(id);
      if (!productCode) return next(apiErrors.productNotFound);
      const checked = await UserCheckScanProduct.findOne({ productCode: id });

      if (isCheck) {
        if (checked) return next(apiErrors.productWasChecked);
        const newChecked = await UserCheckScanProduct.create({
          user,
          productCode: id,
          restaurant: productCode.restaurant,
          productPackage: productCode.productPackage,
        });
        return res.json(apiResponse({
          message: 'Marquer le produit scanné avec succès',
          payload: newChecked,
        }));
      }

      if (!checked) return next(apiErrors.productWasNotChecked);
      await UserCheckScanProduct.findOneAndDelete({ productCode: id });
      return res.json(apiResponse({
        message: 'Décochez le produit scanné a été avec succès',
      }));
    } catch (error) {
      next(error);
    }
  },
  onUnCheckScanProductCode: async (req, res, next) => {
    try {
      const { id } = req.params;
      await UserCheckScanProduct.findByIdAndDelete(id);
      return res.json(apiResponse({
        message: 'Décochez le produit scanné a été avec succès',
      }));
    } catch (error) {
      next(error);
    }
  },

  onMergeProduct: async (req, res, next) => {
    try {
      const {
        body:
        {
          mergeIndexProduct, referenceProduct, converter, isMergeProduct,
        },
        params: { id: currentProduct },
      } = req;

      const refProduct = await IndexProducts.findById(mergeIndexProduct).lean();
      if (!refProduct || !isMergeProduct) {
        const updateProduct = await Products.findByIdAndUpdate(
          currentProduct,
          {
            mergeIndexProduct: null,
          },
          { new: true },
        );
        if (!refProduct) {
          return next(apiErrors.productIndexNotFound);
        }
        return res.json(apiResponse({
          message: 'Le produit a été mis à jour avec succès',
          payload: updateProduct,
        }));
        // xử lý
      }

      // cập nhật sản phẩm hiện tại bằng thông tin sản phẩm tham chiếu - xóa merger ID
      const updateProduct = await Products.findByIdAndUpdate(
        currentProduct,
        {
          sku: refProduct.sku,
          title: refProduct.title,
          slug: refProduct.slug,
          converter: refProduct.converter,
          referenceProduct: mergeIndexProduct,
          mergeIndexProduct: null,
        },
        { new: true },
      );

      // xóa sản phẩm tham chiếu của sản phẩm cũ.
      await IndexProducts.deleteOne({ _id: referenceProduct });

      // tạo mới mã codes nếu số lượng converter tham chiếu khác hiện tại
      if (refProduct.converter !== converter) {
        // Tạo lại codes cho sản phẩm
        const numberOfCodes = await countNumberOfCodes(
          refProduct.converter, updateProduct.quantity,
        );
        const quantity = await countQuantity(updateProduct.quantity, numberOfCodes);
        let j = 0;

        for (j; j < numberOfCodes; j += 1) {
          await ProductCodes.create({
            quantity,
            totalPrice: updateProduct.totalPrice / numberOfCodes,
            productPackage: updateProduct.productPackage,
            product: updateProduct._id,
            user: updateProduct.user,
            restaurant: updateProduct.restaurant,
            title: updateProduct.title,
            slug: createSlug(updateProduct.title),
            tariffs: {
              unit: updateProduct.tariffs.unit,
              price: updateProduct.tariffs.price,
            },
            unit: updateProduct.unit,
            sku: updateProduct.sku,
            status: updateProduct.status,
            referenceProduct: updateProduct.referenceProduct,
          });
          await delay(50);
        }
      }

      return res.json(apiResponse({
        message: 'Le produit a été fusionné avec succès',
        payload: updateProduct,
      }));
    } catch (error) {
      next(error);
    }
  },
};
