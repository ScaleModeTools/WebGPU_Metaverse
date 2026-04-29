import type { HumanoidV2BoneName } from "./asset-socket";

export const humanoidV2RigDescriptorSummary = {
  "sourceFile": "2ways.glb",
  "generator": "THREE.GLTFExporter r183",
  "mesh": {
    "meshCount": 1,
    "vertexCount": 8722,
    "indexCount": 41139,
    "primitiveCount": 1
  },
  "skeleton": {
    "skinCount": 1,
    "jointCount": 66,
    "rootJoint": "root"
  }
} as const;

export const humanoidV2BoneCategories = [
  "root",
  "hips",
  "spine",
  "head_neck",
  "arm",
  "finger",
  "leg"
] as const;

export type HumanoidV2BoneCategory = (typeof humanoidV2BoneCategories)[number];

export const humanoidV2BoneSides = [
  "center",
  "left",
  "right"
] as const;

export type HumanoidV2BoneSide = (typeof humanoidV2BoneSides)[number];

export const humanoidV2BoneDescriptors = [
  {
    "skinJointIndex": 0,
    "nodeIndex": 1,
    "name": "root",
    "humanAlias": "root / scene-scale orientation bone",
    "parent": null,
    "children": [
      "pelvis"
    ],
    "depth": 0,
    "side": "center",
    "category": "root",
    "isEndLeaf": false,
    "weightedVertexCount": 0,
    "weightSum": 0,
    "localTRS": {
      "translation": null,
      "rotation": [
        -0.7071067690849304,
        -1.01163241314817e-30,
        1.01163241314817e-30,
        0.7071067690849304
      ],
      "scale": null
    }
  },
  {
    "skinJointIndex": 1,
    "nodeIndex": 2,
    "name": "pelvis",
    "humanAlias": "hips / pelvis driver",
    "parent": "root",
    "children": [
      "spine_01",
      "thigh_l",
      "thigh_r"
    ],
    "depth": 1,
    "side": "center",
    "category": "hips",
    "isEndLeaf": false,
    "weightedVertexCount": 0,
    "weightSum": 0,
    "localTRS": {
      "translation": [
        0.014889445606295869,
        0.047504726740678356,
        0.8355289420005956
      ],
      "rotation": [
        0.7596720710187742,
        -0.09963891787578431,
        -0.07168007545320276,
        0.638617567360633
      ],
      "scale": null
    }
  },
  {
    "skinJointIndex": 2,
    "nodeIndex": 3,
    "name": "spine_01",
    "humanAlias": "lower spine",
    "parent": "pelvis",
    "children": [
      "spine_02"
    ],
    "depth": 2,
    "side": "center",
    "category": "spine",
    "isEndLeaf": false,
    "weightedVertexCount": 692,
    "weightSum": 446.099999,
    "localTRS": {
      "translation": [
        -3.3999727802242244e-16,
        0.1039731428027153,
        5.587935447692871e-9
      ],
      "rotation": [
        0.01380657380344502,
        -0.1717431865242712,
        -0.0016510139402045347,
        0.9850436186054244
      ],
      "scale": [
        1,
        0.9999999403953552,
        1
      ]
    }
  },
  {
    "skinJointIndex": 3,
    "nodeIndex": 4,
    "name": "spine_02",
    "humanAlias": "mid spine",
    "parent": "spine_01",
    "children": [
      "spine_03"
    ],
    "depth": 3,
    "side": "center",
    "category": "spine",
    "isEndLeaf": false,
    "weightedVertexCount": 359,
    "weightSum": 222.099999,
    "localTRS": {
      "translation": [
        1.3330509232681613e-15,
        0.12403497099876404,
        -1.1175870895385742e-8
      ],
      "rotation": [
        -0.005610985470874743,
        -0.02206681590205672,
        -0.05197145734456584,
        0.9983889723446833
      ],
      "scale": [
        1,
        0.9999998807907104,
        0.9999999403953552
      ]
    }
  },
  {
    "skinJointIndex": 4,
    "nodeIndex": 5,
    "name": "spine_03",
    "humanAlias": "upper spine / chest",
    "parent": "spine_02",
    "children": [
      "neck_01",
      "clavicle_l",
      "clavicle_r"
    ],
    "depth": 4,
    "side": "center",
    "category": "spine",
    "isEndLeaf": false,
    "weightedVertexCount": 169,
    "weightSum": 70.7,
    "localTRS": {
      "translation": [
        -2.9745594821908167e-16,
        0.14127187430858612,
        -9.313225746154785e-10
      ],
      "rotation": [
        -0.22164170483098616,
        -0.028209924281058604,
        0.08481792972224352,
        0.9710226947138276
      ],
      "scale": [
        1,
        1,
        0.9999999403953552
      ]
    }
  },
  {
    "skinJointIndex": 5,
    "nodeIndex": 6,
    "name": "neck_01",
    "humanAlias": "neck",
    "parent": "spine_03",
    "children": [
      "head"
    ],
    "depth": 5,
    "side": "center",
    "category": "head_neck",
    "isEndLeaf": false,
    "weightedVertexCount": 204,
    "weightSum": 97.45,
    "localTRS": {
      "translation": [
        -4.998441371635402e-15,
        0.17480099201202393,
        1.1175870895385742e-8
      ],
      "rotation": [
        0.3778020893782203,
        -0.1539708731654297,
        0.05949378643759477,
        0.911053807880437
      ],
      "scale": [
        1,
        0.9999999403953552,
        0.9999999403953552
      ]
    }
  },
  {
    "skinJointIndex": 6,
    "nodeIndex": 7,
    "name": "head",
    "humanAlias": "head",
    "parent": "neck_01",
    "children": [
      "head_leaf"
    ],
    "depth": 6,
    "side": "center",
    "category": "head_neck",
    "isEndLeaf": false,
    "weightedVertexCount": 149,
    "weightSum": 78.85,
    "localTRS": {
      "translation": [
        1.8347462085862784e-15,
        0.13206438720226288,
        5.681067705154419e-8
      ],
      "rotation": [
        -0.15889814038590624,
        -0.1466584286819158,
        0.0718535694445382,
        0.9736938691583361
      ],
      "scale": [
        1,
        0.9999999403953552,
        1
      ]
    }
  },
  {
    "skinJointIndex": 7,
    "nodeIndex": 8,
    "name": "head_leaf",
    "humanAlias": "head end / head tip",
    "parent": "head",
    "children": [],
    "depth": 7,
    "side": "center",
    "category": "head_neck",
    "isEndLeaf": true,
    "weightedVertexCount": 193,
    "weightSum": 161.5,
    "localTRS": {
      "translation": [
        1.064732273159917e-15,
        0.06980981677770615,
        -1.862645149230957e-9
      ],
      "rotation": [
        -0.0032126303216403113,
        -0.1613368805420386,
        0.019932666142640255,
        0.9866928492716599
      ],
      "scale": null
    }
  },
  {
    "skinJointIndex": 8,
    "nodeIndex": 9,
    "name": "clavicle_l",
    "humanAlias": "left clavicle / shoulder",
    "parent": "spine_03",
    "children": [
      "upperarm_l"
    ],
    "depth": 5,
    "side": "left",
    "category": "arm",
    "isEndLeaf": false,
    "weightedVertexCount": 195,
    "weightSum": 127.05,
    "localTRS": {
      "translation": [
        0.01879996992647648,
        0.12312934547662735,
        0.10553931444883347
      ],
      "rotation": [
        -0.5308114886283875,
        -0.28815382719039917,
        -0.3146486282348633,
        0.732258677482605
      ],
      "scale": [
        1,
        1,
        0.9999999403953552
      ]
    }
  },
  {
    "skinJointIndex": 9,
    "nodeIndex": 10,
    "name": "upperarm_l",
    "humanAlias": "left upper arm",
    "parent": "clavicle_l",
    "children": [
      "lowerarm_l"
    ],
    "depth": 6,
    "side": "left",
    "category": "arm",
    "isEndLeaf": false,
    "weightedVertexCount": 166,
    "weightSum": 144.5,
    "localTRS": {
      "translation": [
        -1.30385160446167e-8,
        0.20208464562892914,
        6.775371730327606e-8
      ],
      "rotation": [
        0.21950751766961193,
        0.5960540498666204,
        -0.49918709669978933,
        0.5893626727319722
      ],
      "scale": [
        0.9999999403953552,
        0.9999998807907104,
        1
      ]
    }
  },
  {
    "skinJointIndex": 10,
    "nodeIndex": 11,
    "name": "lowerarm_l",
    "humanAlias": "left forearm",
    "parent": "upperarm_l",
    "children": [
      "hand_l"
    ],
    "depth": 7,
    "side": "left",
    "category": "arm",
    "isEndLeaf": false,
    "weightedVertexCount": 116,
    "weightSum": 93,
    "localTRS": {
      "translation": [
        5.882066034246236e-8,
        0.2965947389602661,
        2.6921043172478676e-9
      ],
      "rotation": [
        0.8786369664615106,
        0.00011244666954808496,
        -0.2735686974699604,
        0.3913530839122775
      ],
      "scale": null
    }
  },
  {
    "skinJointIndex": 11,
    "nodeIndex": 12,
    "name": "hand_l",
    "humanAlias": "left wrist / hand",
    "parent": "lowerarm_l",
    "children": [
      "index_01_l",
      "middle_01_l",
      "pinky_01_l",
      "ring_01_l",
      "thumb_01_l"
    ],
    "depth": 8,
    "side": "left",
    "category": "arm",
    "isEndLeaf": false,
    "weightedVertexCount": 88,
    "weightSum": 56,
    "localTRS": {
      "translation": [
        -6.998743629083037e-8,
        0.2797882556915283,
        4.409230314195156e-9
      ],
      "rotation": [
        0.14677300637345211,
        -0.586638759715533,
        0.0657660565546394,
        0.7937175557923685
      ],
      "scale": [
        0.9999999403953552,
        0.9999999403953552,
        0.9999998807907104
      ]
    }
  },
  {
    "skinJointIndex": 12,
    "nodeIndex": 13,
    "name": "index_01_l",
    "humanAlias": "left index finger proximal / base",
    "parent": "hand_l",
    "children": [
      "index_02_l"
    ],
    "depth": 9,
    "side": "left",
    "category": "finger",
    "isEndLeaf": false,
    "weightedVertexCount": 392,
    "weightSum": 325,
    "localTRS": {
      "translation": [
        0.003783530555665493,
        0.1109822541475296,
        0.030899982899427414
      ],
      "rotation": [
        0.44347232580184937,
        0.5458751320838928,
        -0.4449504613876343,
        0.5544112920761108
      ],
      "scale": [
        0.9999999403953552,
        0.9999997615814209,
        1
      ]
    }
  },
  {
    "skinJointIndex": 13,
    "nodeIndex": 14,
    "name": "index_02_l",
    "humanAlias": "left index finger intermediate / middle",
    "parent": "index_01_l",
    "children": [
      "index_03_l"
    ],
    "depth": 10,
    "side": "left",
    "category": "finger",
    "isEndLeaf": false,
    "weightedVertexCount": 283,
    "weightSum": 200,
    "localTRS": {
      "translation": [
        -1.695902973608554e-9,
        0.040700048208236694,
        -1.2281698502647487e-7
      ],
      "rotation": [
        0.6282097697257996,
        -0.006038919556885958,
        -0.0010427047964185476,
        0.778019905090332
      ],
      "scale": null
    }
  },
  {
    "skinJointIndex": 14,
    "nodeIndex": 15,
    "name": "index_03_l",
    "humanAlias": "left index finger distal",
    "parent": "index_02_l",
    "children": [
      "index_04_leaf_l"
    ],
    "depth": 11,
    "side": "left",
    "category": "finger",
    "isEndLeaf": false,
    "weightedVertexCount": 177,
    "weightSum": 123.5,
    "localTRS": {
      "translation": [
        9.858921456995517e-10,
        0.034800074994564056,
        -1.2729688592116872e-7
      ],
      "rotation": [
        0.6282097697257996,
        -0.0060388753190636635,
        -0.0010427494999021292,
        0.778019905090332
      ],
      "scale": null
    }
  },
  {
    "skinJointIndex": 15,
    "nodeIndex": 16,
    "name": "index_04_leaf_l",
    "humanAlias": "left index finger tip end",
    "parent": "index_03_l",
    "children": [],
    "depth": 12,
    "side": "left",
    "category": "finger",
    "isEndLeaf": false,
    "weightedVertexCount": 29,
    "weightSum": 15.5,
    "localTRS": {
      "translation": [
        9.858922567218542e-10,
        0.034800074994564056,
        -1.2729688592116872e-7
      ],
      "rotation": [
        0.6282097697257996,
        -0.006038905121386051,
        -0.0010427518282085657,
        0.778019905090332
      ],
      "scale": null
    }
  },
  {
    "skinJointIndex": 16,
    "nodeIndex": 17,
    "name": "middle_01_l",
    "humanAlias": "left middle finger proximal / base",
    "parent": "hand_l",
    "children": [
      "middle_02_l"
    ],
    "depth": 9,
    "side": "left",
    "category": "finger",
    "isEndLeaf": false,
    "weightedVertexCount": 387,
    "weightSum": 273,
    "localTRS": {
      "translation": [
        0.0013832158874720335,
        0.1126822978258133,
        0.005200004670768976
      ],
      "rotation": [
        0.43045470118522644,
        0.5561978220939636,
        -0.4579220414161682,
        0.5437464118003845
      ],
      "scale": [
        1,
        1.0000001192092896,
        1
      ]
    }
  },
  {
    "skinJointIndex": 17,
    "nodeIndex": 18,
    "name": "middle_02_l",
    "humanAlias": "left middle finger intermediate / middle",
    "parent": "middle_01_l",
    "children": [
      "middle_03_l"
    ],
    "depth": 10,
    "side": "left",
    "category": "finger",
    "isEndLeaf": false,
    "weightedVertexCount": 311,
    "weightSum": 205.5,
    "localTRS": {
      "translation": [
        -5.766196409240365e-9,
        0.042347412556409836,
        1.8666128198674414e-8
      ],
      "rotation": [
        0.6278289556503296,
        0.02268710732460022,
        0.00013478622713591903,
        0.7780206203460693
      ],
      "scale": [
        0.9999999403953552,
        0.9999998807907104,
        1
      ]
    }
  },
  {
    "skinJointIndex": 18,
    "nodeIndex": 19,
    "name": "middle_03_l",
    "humanAlias": "left middle finger distal",
    "parent": "middle_02_l",
    "children": [
      "middle_04_leaf_l"
    ],
    "depth": 11,
    "side": "left",
    "category": "finger",
    "isEndLeaf": false,
    "weightedVertexCount": 185,
    "weightSum": 125.5,
    "localTRS": {
      "translation": [
        -2.9713191906921566e-9,
        0.03393332660198212,
        -8.414650665145018e-8
      ],
      "rotation": [
        0.6278377771377563,
        0.02244611829519272,
        -0.0019216070650145411,
        0.7780181169509888
      ],
      "scale": null
    }
  },
  {
    "skinJointIndex": 19,
    "nodeIndex": 20,
    "name": "middle_04_leaf_l",
    "humanAlias": "left middle finger tip end",
    "parent": "middle_03_l",
    "children": [],
    "depth": 12,
    "side": "left",
    "category": "finger",
    "isEndLeaf": false,
    "weightedVertexCount": 22,
    "weightSum": 12,
    "localTRS": {
      "translation": [
        -2.9722286853939295e-9,
        0.03393327072262764,
        -2.1643481318278646e-7
      ],
      "rotation": [
        0.6281803846359253,
        0.00856052991002798,
        0.017036421224474907,
        0.7778341174125671
      ],
      "scale": [
        1,
        0.9999999403953552,
        1
      ]
    }
  },
  {
    "skinJointIndex": 20,
    "nodeIndex": 21,
    "name": "pinky_01_l",
    "humanAlias": "left pinky finger proximal / base",
    "parent": "hand_l",
    "children": [
      "pinky_02_l"
    ],
    "depth": 9,
    "side": "left",
    "category": "finger",
    "isEndLeaf": false,
    "weightedVertexCount": 414,
    "weightSum": 338,
    "localTRS": {
      "translation": [
        0.0033830071333795786,
        0.0987820103764534,
        -0.04079994931817055
      ],
      "rotation": [
        0.4249226152896881,
        0.5604358911514282,
        -0.4632871448993683,
        0.5391823053359985
      ],
      "scale": [
        1,
        0.9999998807907104,
        1
      ]
    }
  },
  {
    "skinJointIndex": 21,
    "nodeIndex": 22,
    "name": "pinky_02_l",
    "humanAlias": "left pinky finger intermediate / middle",
    "parent": "pinky_01_l",
    "children": [
      "pinky_03_l"
    ],
    "depth": 10,
    "side": "left",
    "category": "finger",
    "isEndLeaf": false,
    "weightedVertexCount": 243,
    "weightSum": 172,
    "localTRS": {
      "translation": [
        -8.731149137020111e-11,
        0.040290672332048416,
        -1.2894767564830545e-7
      ],
      "rotation": [
        0.6271719336509705,
        0.036596205085515976,
        -0.0016917807515710592,
        0.7780187726020813
      ],
      "scale": null
    }
  },
  {
    "skinJointIndex": 22,
    "nodeIndex": 23,
    "name": "pinky_03_l",
    "humanAlias": "left pinky finger distal",
    "parent": "pinky_02_l",
    "children": [
      "pinky_04_leaf_l"
    ],
    "depth": 11,
    "side": "left",
    "category": "finger",
    "isEndLeaf": false,
    "weightedVertexCount": 162,
    "weightSum": 108.5,
    "localTRS": {
      "translation": [
        2.9467628337442875e-9,
        0.027665486559271812,
        -1.5391344732051948e-7
      ],
      "rotation": [
        0.6271637678146362,
        0.03673719987273216,
        -0.0005681744660250843,
        0.7780203819274902
      ],
      "scale": [
        0.9999999403953552,
        0.9999998211860657,
        1
      ]
    }
  },
  {
    "skinJointIndex": 23,
    "nodeIndex": 24,
    "name": "pinky_04_leaf_l",
    "humanAlias": "left pinky finger tip end",
    "parent": "pinky_03_l",
    "children": [],
    "depth": 12,
    "side": "left",
    "category": "finger",
    "isEndLeaf": false,
    "weightedVertexCount": 25,
    "weightSum": 14.5,
    "localTRS": {
      "translation": [
        -7.776179700158536e-10,
        0.027665577828884125,
        -2.7516108502823045e-8
      ],
      "rotation": [
        0.6280555725097656,
        0.015166549943387508,
        0.025216130539774895,
        0.7776119709014893
      ],
      "scale": [
        0.9999999403953552,
        0.9999999403953552,
        1
      ]
    }
  },
  {
    "skinJointIndex": 24,
    "nodeIndex": 25,
    "name": "ring_01_l",
    "humanAlias": "left ring finger proximal / base",
    "parent": "hand_l",
    "children": [
      "ring_02_l"
    ],
    "depth": 9,
    "side": "left",
    "category": "finger",
    "isEndLeaf": false,
    "weightedVertexCount": 396,
    "weightSum": 275.5,
    "localTRS": {
      "translation": [
        0.0016834731213748455,
        0.11018212139606476,
        -0.017099978402256966
      ],
      "rotation": [
        0.43368399143218994,
        0.5536836981773376,
        -0.45475009083747864,
        0.546401858329773
      ],
      "scale": [
        0.9999999403953552,
        0.9999997615814209,
        1
      ]
    }
  },
  {
    "skinJointIndex": 25,
    "nodeIndex": 26,
    "name": "ring_02_l",
    "humanAlias": "left ring finger intermediate / middle",
    "parent": "ring_01_l",
    "children": [
      "ring_03_l"
    ],
    "depth": 10,
    "side": "left",
    "category": "finger",
    "isEndLeaf": false,
    "weightedVertexCount": 253,
    "weightSum": 163,
    "localTRS": {
      "translation": [
        3.992681740783155e-9,
        0.039324935525655746,
        -1.24768590126223e-7
      ],
      "rotation": [
        0.6280266046524048,
        0.016321707516908646,
        -0.0010333488462492824,
        0.7780200242996216
      ],
      "scale": null
    }
  },
  {
    "skinJointIndex": 26,
    "nodeIndex": 27,
    "name": "ring_03_l",
    "humanAlias": "left ring finger distal",
    "parent": "ring_02_l",
    "children": [
      "ring_04_leaf_l"
    ],
    "depth": 11,
    "side": "left",
    "category": "finger",
    "isEndLeaf": false,
    "weightedVertexCount": 166,
    "weightSum": 117,
    "localTRS": {
      "translation": [
        2.6457200874574482e-9,
        0.030919700860977173,
        -2.054092362868687e-8
      ],
      "rotation": [
        0.6280090808868408,
        0.016984310001134872,
        -0.0018728866707533598,
        0.7780184149742126
      ],
      "scale": null
    }
  },
  {
    "skinJointIndex": 27,
    "nodeIndex": 28,
    "name": "ring_04_leaf_l",
    "humanAlias": "left ring finger tip end",
    "parent": "ring_03_l",
    "children": [],
    "depth": 12,
    "side": "left",
    "category": "finger",
    "isEndLeaf": false,
    "weightedVertexCount": 28,
    "weightSum": 16.5,
    "localTRS": {
      "translation": [
        -8.531060302630067e-9,
        0.030919687822461128,
        8.642015814075421e-8
      ],
      "rotation": [
        0.6282119154930115,
        0.005808766465634108,
        0.013629085384309292,
        0.777901291847229
      ],
      "scale": [
        1,
        0.9999999403953552,
        1
      ]
    }
  },
  {
    "skinJointIndex": 28,
    "nodeIndex": 29,
    "name": "thumb_01_l",
    "humanAlias": "left thumb base / CMC-metacarpal",
    "parent": "hand_l",
    "children": [
      "thumb_02_l"
    ],
    "depth": 9,
    "side": "left",
    "category": "finger",
    "isEndLeaf": false,
    "weightedVertexCount": 179,
    "weightSum": 130.5,
    "localTRS": {
      "translation": [
        0.02279968187212944,
        0.02729995734989643,
        0.03359999880194664
      ],
      "rotation": [
        0.24741333723068237,
        0.9457944631576538,
        0.2034410685300827,
        0.05358394607901573
      ],
      "scale": [
        1,
        0.9999998807907104,
        0.9999999403953552
      ]
    }
  },
  {
    "skinJointIndex": 29,
    "nodeIndex": 30,
    "name": "thumb_02_l",
    "humanAlias": "left thumb proximal",
    "parent": "thumb_01_l",
    "children": [
      "thumb_03_l"
    ],
    "depth": 10,
    "side": "left",
    "category": "finger",
    "isEndLeaf": false,
    "weightedVertexCount": 263,
    "weightSum": 226,
    "localTRS": {
      "translation": [
        1.6188005247386172e-7,
        0.043029963970184326,
        -2.7939677238464355e-9
      ],
      "rotation": [
        0.562318742275238,
        -0.20117270946502686,
        0.16253463923931122,
        0.7854359745979309
      ],
      "scale": [
        0.9999999403953552,
        1,
        1
      ]
    }
  },
  {
    "skinJointIndex": 30,
    "nodeIndex": 31,
    "name": "thumb_03_l",
    "humanAlias": "left thumb distal",
    "parent": "thumb_02_l",
    "children": [
      "thumb_04_leaf_l"
    ],
    "depth": 11,
    "side": "left",
    "category": "finger",
    "isEndLeaf": false,
    "weightedVertexCount": 139,
    "weightSum": 125,
    "localTRS": {
      "translation": [
        1.7802267393562943e-7,
        0.05082334205508232,
        3.562308847904205e-8
      ],
      "rotation": [
        0.7731974720954895,
        -0.2343185544013977,
        -0.22240807116031647,
        0.5457060933113098
      ],
      "scale": [
        1,
        0.9999998807907104,
        1
      ]
    }
  },
  {
    "skinJointIndex": 31,
    "nodeIndex": 32,
    "name": "thumb_04_leaf_l",
    "humanAlias": "left thumb tip end",
    "parent": "thumb_03_l",
    "children": [],
    "depth": 12,
    "side": "left",
    "category": "finger",
    "isEndLeaf": false,
    "weightedVertexCount": 0,
    "weightSum": 0,
    "localTRS": {
      "translation": [
        5.291076377034187e-8,
        0.047168850898742676,
        5.774199962615967e-8
      ],
      "rotation": [
        0.06115054711699486,
        -0.01591254211962223,
        -0.022969534620642662,
        0.9977374076843262
      ],
      "scale": [
        0.9999999403953552,
        0.9999999403953552,
        0.9999999403953552
      ]
    }
  },
  {
    "skinJointIndex": 32,
    "nodeIndex": 33,
    "name": "clavicle_r",
    "humanAlias": "right clavicle / shoulder",
    "parent": "spine_03",
    "children": [
      "upperarm_r"
    ],
    "depth": 5,
    "side": "right",
    "category": "arm",
    "isEndLeaf": false,
    "weightedVertexCount": 192,
    "weightSum": 126.05,
    "localTRS": {
      "translation": [
        -0.018799999728798866,
        0.12312934547662735,
        0.10553930699825287
      ],
      "rotation": [
        -0.530811607837677,
        0.28815382719039917,
        0.3146485388278961,
        0.732258677482605
      ],
      "scale": [
        1,
        1.0000001192092896,
        1
      ]
    }
  },
  {
    "skinJointIndex": 33,
    "nodeIndex": 34,
    "name": "upperarm_r",
    "humanAlias": "right upper arm",
    "parent": "clavicle_r",
    "children": [
      "lowerarm_r"
    ],
    "depth": 6,
    "side": "right",
    "category": "arm",
    "isEndLeaf": false,
    "weightedVertexCount": 166,
    "weightSum": 144.5,
    "localTRS": {
      "translation": [
        -5.587935447692871e-9,
        0.20208466053009033,
        7.334165275096893e-8
      ],
      "rotation": [
        -0.3398483565287888,
        -0.7212658358562352,
        -0.11925439432305288,
        0.5916563039549338
      ],
      "scale": [
        1,
        1.0000001192092896,
        1.0000001192092896
      ]
    }
  },
  {
    "skinJointIndex": 34,
    "nodeIndex": 35,
    "name": "lowerarm_r",
    "humanAlias": "right forearm",
    "parent": "upperarm_r",
    "children": [
      "hand_r"
    ],
    "depth": 7,
    "side": "right",
    "category": "arm",
    "isEndLeaf": false,
    "weightedVertexCount": 116,
    "weightSum": 93,
    "localTRS": {
      "translation": [
        -8.03374859970063e-8,
        0.29659464955329895,
        1.1059455573558807e-9
      ],
      "rotation": [
        0.008814875770937421,
        -0.00028728860507523733,
        0.0027445479017064447,
        0.999957314923454
      ],
      "scale": [
        1,
        1,
        1.0000001192092896
      ]
    }
  },
  {
    "skinJointIndex": 35,
    "nodeIndex": 36,
    "name": "hand_r",
    "humanAlias": "right wrist / hand",
    "parent": "lowerarm_r",
    "children": [
      "index_01_r",
      "middle_01_r",
      "pinky_01_r",
      "ring_01_r",
      "thumb_01_r"
    ],
    "depth": 8,
    "side": "right",
    "category": "arm",
    "isEndLeaf": false,
    "weightedVertexCount": 88,
    "weightSum": 56,
    "localTRS": {
      "translation": [
        6.719892553519458e-8,
        0.27978813648223877,
        1.4479155652225018e-9
      ],
      "rotation": [
        0.4595872842755959,
        0.09193156998194728,
        0.11152534263751113,
        0.8762934643089437
      ],
      "scale": [
        0.9999998807907104,
        0.9999999403953552,
        0.9999998211860657
      ]
    }
  },
  {
    "skinJointIndex": 36,
    "nodeIndex": 37,
    "name": "index_01_r",
    "humanAlias": "right index finger proximal / base",
    "parent": "hand_r",
    "children": [
      "index_02_r"
    ],
    "depth": 9,
    "side": "right",
    "category": "finger",
    "isEndLeaf": false,
    "weightedVertexCount": 392,
    "weightSum": 325,
    "localTRS": {
      "translation": [
        -0.003783653024584055,
        0.11098221689462662,
        0.030899981036782265
      ],
      "rotation": [
        0.468291312456131,
        -0.4906286299228668,
        0.4505227208137512,
        0.5805309414863586
      ],
      "scale": [
        1,
        0.9999998807907104,
        1
      ]
    }
  },
  {
    "skinJointIndex": 37,
    "nodeIndex": 38,
    "name": "index_02_r",
    "humanAlias": "right index finger intermediate / middle",
    "parent": "index_01_r",
    "children": [
      "index_03_r"
    ],
    "depth": 10,
    "side": "right",
    "category": "finger",
    "isEndLeaf": false,
    "weightedVertexCount": 283,
    "weightSum": 200,
    "localTRS": {
      "translation": [
        -2.861555437050356e-9,
        0.040699999779462814,
        -5.446382012053164e-9
      ],
      "rotation": [
        0.6496995687484741,
        0.06357332319021225,
        -0.012566867284476757,
        0.7574239373207092
      ],
      "scale": null
    }
  },
  {
    "skinJointIndex": 38,
    "nodeIndex": 39,
    "name": "index_03_r",
    "humanAlias": "right index finger distal",
    "parent": "index_02_r",
    "children": [
      "index_04_leaf_r"
    ],
    "depth": 11,
    "side": "right",
    "category": "finger",
    "isEndLeaf": false,
    "weightedVertexCount": 177,
    "weightSum": 123.5,
    "localTRS": {
      "translation": [
        -4.7084540710784495e-9,
        0.034799911081790924,
        -4.697085387306288e-9
      ],
      "rotation": [
        0.6496994495391846,
        0.06357331573963165,
        -0.01256686169654131,
        0.757423996925354
      ],
      "scale": null
    }
  },
  {
    "skinJointIndex": 39,
    "nodeIndex": 40,
    "name": "index_04_leaf_r",
    "humanAlias": "right index finger tip end",
    "parent": "index_03_r",
    "children": [],
    "depth": 12,
    "side": "right",
    "category": "finger",
    "isEndLeaf": false,
    "weightedVertexCount": 29,
    "weightSum": 15.5,
    "localTRS": {
      "translation": [
        -4.7084540710784495e-9,
        0.0347999706864357,
        -4.697085387306288e-9
      ],
      "rotation": [
        0.6496994495391846,
        0.06357331573963165,
        -0.012566878460347652,
        0.757423996925354
      ],
      "scale": null
    }
  },
  {
    "skinJointIndex": 40,
    "nodeIndex": 41,
    "name": "middle_01_r",
    "humanAlias": "right middle finger proximal / base",
    "parent": "hand_r",
    "children": [
      "middle_02_r"
    ],
    "depth": 9,
    "side": "right",
    "category": "finger",
    "isEndLeaf": false,
    "weightedVertexCount": 387,
    "weightSum": 273,
    "localTRS": {
      "translation": [
        -0.0013833382399752736,
        0.11268225312232971,
        0.005200011655688286
      ],
      "rotation": [
        0.45657163858413696,
        -0.5015530586242676,
        0.4641096591949463,
        0.5697271823883057
      ],
      "scale": [
        1,
        1.0000001192092896,
        1
      ]
    }
  },
  {
    "skinJointIndex": 41,
    "nodeIndex": 42,
    "name": "middle_02_r",
    "humanAlias": "right middle finger intermediate / middle",
    "parent": "middle_01_r",
    "children": [
      "middle_03_r"
    ],
    "depth": 10,
    "side": "right",
    "category": "finger",
    "isEndLeaf": false,
    "weightedVertexCount": 311,
    "weightSum": 205.5,
    "localTRS": {
      "translation": [
        2.432898327242583e-9,
        0.04234735295176506,
        1.8621250319483806e-8
      ],
      "rotation": [
        0.651926577091217,
        0.03380472585558891,
        -0.013713179156184196,
        0.757404088973999
      ],
      "scale": [
        0.9999999403953552,
        0.9999999403953552,
        1
      ]
    }
  },
  {
    "skinJointIndex": 42,
    "nodeIndex": 43,
    "name": "middle_03_r",
    "humanAlias": "right middle finger distal",
    "parent": "middle_02_r",
    "children": [
      "middle_04_leaf_r"
    ],
    "depth": 11,
    "side": "right",
    "category": "finger",
    "isEndLeaf": false,
    "weightedVertexCount": 185,
    "weightSum": 125.5,
    "localTRS": {
      "translation": [
        -7.521521183662117e-10,
        0.03393326699733734,
        3.725014607880439e-8
      ],
      "rotation": [
        0.651913583278656,
        0.034054990857839584,
        -0.01171126775443554,
        0.7574376463890076
      ],
      "scale": null
    }
  },
  {
    "skinJointIndex": 43,
    "nodeIndex": 44,
    "name": "middle_04_leaf_r",
    "humanAlias": "right middle finger tip end",
    "parent": "middle_03_r",
    "children": [],
    "depth": 12,
    "side": "right",
    "category": "finger",
    "isEndLeaf": false,
    "weightedVertexCount": 22,
    "weightSum": 12,
    "localTRS": {
      "translation": [
        -7.530616130679846e-10,
        0.033933330327272415,
        2.3981868935152306e-8
      ],
      "rotation": [
        0.6510012745857239,
        0.0484590120613575,
        -0.03016376495361328,
        0.756927490234375
      ],
      "scale": null
    }
  },
  {
    "skinJointIndex": 44,
    "nodeIndex": 45,
    "name": "pinky_01_r",
    "humanAlias": "right pinky finger proximal / base",
    "parent": "hand_r",
    "children": [
      "pinky_02_r"
    ],
    "depth": 9,
    "side": "right",
    "category": "finger",
    "isEndLeaf": false,
    "weightedVertexCount": 414,
    "weightSum": 338,
    "localTRS": {
      "translation": [
        -0.003383129369467497,
        0.09878195822238922,
        -0.04079994186758995
      ],
      "rotation": [
        0.4515798091888428,
        -0.506052553653717,
        0.469731867313385,
        0.5651004910469055
      ],
      "scale": null
    }
  },
  {
    "skinJointIndex": 45,
    "nodeIndex": 46,
    "name": "pinky_02_r",
    "humanAlias": "right pinky finger intermediate / middle",
    "parent": "pinky_01_r",
    "children": [
      "pinky_03_r"
    ],
    "depth": 10,
    "side": "right",
    "category": "finger",
    "isEndLeaf": false,
    "weightedVertexCount": 243,
    "weightSum": 172,
    "localTRS": {
      "translation": [
        1.0164512787014246e-8,
        0.04029066115617752,
        -1.323162734934158e-7
      ],
      "rotation": [
        0.652515709400177,
        0.01934768073260784,
        -0.011934999376535416,
        0.7574341893196106
      ],
      "scale": [
        0.9999999403953552,
        0.9999999403953552,
        1
      ]
    }
  },
  {
    "skinJointIndex": 46,
    "nodeIndex": 47,
    "name": "pinky_03_r",
    "humanAlias": "right pinky finger distal",
    "parent": "pinky_02_r",
    "children": [
      "pinky_04_leaf_r"
    ],
    "depth": 11,
    "side": "right",
    "category": "finger",
    "isEndLeaf": false,
    "weightedVertexCount": 161,
    "weightSum": 108,
    "localTRS": {
      "translation": [
        7.812559488229454e-10,
        0.027665477246046066,
        -2.6883202508543036e-7
      ],
      "rotation": [
        0.652519941329956,
        0.019200917333364487,
        -0.013028902933001518,
        0.7574161887168884
      ],
      "scale": [
        0.9999998807907104,
        0.9999998211860657,
        1
      ]
    }
  },
  {
    "skinJointIndex": 47,
    "nodeIndex": 48,
    "name": "pinky_04_leaf_r",
    "humanAlias": "right pinky finger tip end",
    "parent": "pinky_03_r",
    "children": [],
    "depth": 12,
    "side": "right",
    "category": "finger",
    "isEndLeaf": false,
    "weightedVertexCount": 25,
    "weightSum": 14.5,
    "localTRS": {
      "translation": [
        4.5056367525830865e-9,
        0.027665449306368828,
        -1.4233438605515403e-7
      ],
      "rotation": [
        0.6514747738838196,
        0.041609808802604675,
        -0.03812284395098686,
        0.7565684914588928
      ],
      "scale": [
        1,
        0.9999999403953552,
        1
      ]
    }
  },
  {
    "skinJointIndex": 48,
    "nodeIndex": 49,
    "name": "ring_01_r",
    "humanAlias": "right ring finger proximal / base",
    "parent": "hand_r",
    "children": [
      "ring_02_r"
    ],
    "depth": 9,
    "side": "right",
    "category": "finger",
    "isEndLeaf": false,
    "weightedVertexCount": 396,
    "weightSum": 275.5,
    "localTRS": {
      "translation": [
        -0.0016835954738780856,
        0.11018206924200058,
        -0.01709997095167637
      ],
      "rotation": [
        0.4594825208187103,
        -0.49888789653778076,
        0.46078628301620483,
        0.5724182724952698
      ],
      "scale": [
        1,
        1.0000001192092896,
        1.0000001192092896
      ]
    }
  },
  {
    "skinJointIndex": 49,
    "nodeIndex": 50,
    "name": "ring_02_r",
    "humanAlias": "right ring finger intermediate / middle",
    "parent": "ring_01_r",
    "children": [
      "ring_03_r"
    ],
    "depth": 10,
    "side": "right",
    "category": "finger",
    "isEndLeaf": false,
    "weightedVertexCount": 254,
    "weightSum": 163.5,
    "localTRS": {
      "translation": [
        -4.920366336591542e-10,
        0.03932494297623634,
        -2.440193611619179e-7
      ],
      "rotation": [
        0.6515505313873291,
        0.04041152074933052,
        -0.012576039880514145,
        0.7574237585067749
      ],
      "scale": [
        0.9999999403953552,
        0.9999999403953552,
        1
      ]
    }
  },
  {
    "skinJointIndex": 50,
    "nodeIndex": 51,
    "name": "ring_03_r",
    "humanAlias": "right ring finger distal",
    "parent": "ring_02_r",
    "children": [
      "ring_04_leaf_r"
    ],
    "depth": 11,
    "side": "right",
    "category": "finger",
    "isEndLeaf": false,
    "weightedVertexCount": 166,
    "weightSum": 117,
    "localTRS": {
      "translation": [
        4.807588993571699e-9,
        0.030919646844267845,
        -1.3493006179032818e-7
      ],
      "rotation": [
        0.6515927314758301,
        0.03972400352358818,
        -0.011758686974644661,
        0.7574369311332703
      ],
      "scale": null
    }
  },
  {
    "skinJointIndex": 51,
    "nodeIndex": 52,
    "name": "ring_04_leaf_r",
    "humanAlias": "right ring finger tip end",
    "parent": "ring_03_r",
    "children": [],
    "depth": 12,
    "side": "right",
    "category": "finger",
    "isEndLeaf": false,
    "weightedVertexCount": 28,
    "weightSum": 16.5,
    "localTRS": {
      "translation": [
        8.534698281437159e-9,
        0.03091963194310665,
        -1.4736140485638316e-7
      ],
      "rotation": [
        0.650782585144043,
        0.05131012201309204,
        -0.026847926899790764,
        0.7570525407791138
      ],
      "scale": [
        0.9999999403953552,
        0.9999998807907104,
        1
      ]
    }
  },
  {
    "skinJointIndex": 52,
    "nodeIndex": 53,
    "name": "thumb_01_r",
    "humanAlias": "right thumb base / CMC-metacarpal",
    "parent": "hand_r",
    "children": [
      "thumb_02_r"
    ],
    "depth": 9,
    "side": "right",
    "category": "finger",
    "isEndLeaf": false,
    "weightedVertexCount": 179,
    "weightSum": 130.5,
    "localTRS": {
      "translation": [
        -0.02279980294406414,
        0.027299916371703148,
        0.03359999507665634
      ],
      "rotation": [
        -0.35520851612091064,
        0.9341605305671692,
        0.02877776511013508,
        0.018518146127462387
      ],
      "scale": [
        1,
        1.0000001192092896,
        1
      ]
    }
  },
  {
    "skinJointIndex": 53,
    "nodeIndex": 54,
    "name": "thumb_02_r",
    "humanAlias": "right thumb proximal",
    "parent": "thumb_01_r",
    "children": [
      "thumb_03_r"
    ],
    "depth": 10,
    "side": "right",
    "category": "finger",
    "isEndLeaf": false,
    "weightedVertexCount": 263,
    "weightSum": 226,
    "localTRS": {
      "translation": [
        -1.0303938324796036e-7,
        0.04302981495857239,
        -2.514570951461792e-8
      ],
      "rotation": [
        0.4391205906867981,
        0.021466432139277458,
        0.06303632259368896,
        0.8959569334983826
      ],
      "scale": null
    }
  },
  {
    "skinJointIndex": 54,
    "nodeIndex": 55,
    "name": "thumb_03_r",
    "humanAlias": "right thumb distal",
    "parent": "thumb_02_r",
    "children": [
      "thumb_04_leaf_r"
    ],
    "depth": 11,
    "side": "right",
    "category": "finger",
    "isEndLeaf": false,
    "weightedVertexCount": 139,
    "weightSum": 125,
    "localTRS": {
      "translation": [
        1.4956276572775096e-7,
        0.05082337185740471,
        -6.28642737865448e-9
      ],
      "rotation": [
        0.4164186716079712,
        0.03151395171880722,
        0.027205459773540497,
        0.9082192778587341
      ],
      "scale": [
        0.9999999403953552,
        0.9999998807907104,
        1
      ]
    }
  },
  {
    "skinJointIndex": 55,
    "nodeIndex": 56,
    "name": "thumb_04_leaf_r",
    "humanAlias": "right thumb tip end",
    "parent": "thumb_03_r",
    "children": [],
    "depth": 12,
    "side": "right",
    "category": "finger",
    "isEndLeaf": false,
    "weightedVertexCount": 0,
    "weightSum": 0,
    "localTRS": {
      "translation": [
        3.748573362827301e-8,
        0.04716881364583969,
        -5.587935447692871e-9
      ],
      "rotation": [
        0.06115056574344635,
        0.015912499278783798,
        0.022969553247094154,
        0.9977373480796814
      ],
      "scale": [
        0.9999998807907104,
        1,
        1
      ]
    }
  },
  {
    "skinJointIndex": 56,
    "nodeIndex": 57,
    "name": "thigh_l",
    "humanAlias": "left thigh / upper leg",
    "parent": "pelvis",
    "children": [
      "calf_l"
    ],
    "depth": 2,
    "side": "left",
    "category": "leg",
    "isEndLeaf": false,
    "weightedVertexCount": 260,
    "weightSum": 159.15,
    "localTRS": {
      "translation": [
        0.08899997174739838,
        0.02777082286775112,
        0.04602380841970444
      ],
      "rotation": [
        0.9518251216183771,
        0.06371707495895823,
        -0.10495266093515801,
        0.28098756409753434
      ],
      "scale": [
        1,
        1,
        1.000001311302185
      ]
    }
  },
  {
    "skinJointIndex": 57,
    "nodeIndex": 58,
    "name": "calf_l",
    "humanAlias": "left calf / lower leg",
    "parent": "thigh_l",
    "children": [
      "foot_l"
    ],
    "depth": 3,
    "side": "left",
    "category": "leg",
    "isEndLeaf": false,
    "weightedVertexCount": 127,
    "weightSum": 105,
    "localTRS": {
      "translation": [
        3.275728577278869e-9,
        0.4066256582736969,
        -1.593393861298864e-9
      ],
      "rotation": [
        0.4006667089840984,
        -0.00012036124914296243,
        -0.00005256806748770103,
        0.9162238651452055
      ],
      "scale": [
        0.9999999403953552,
        1,
        0.9999999403953552
      ]
    }
  },
  {
    "skinJointIndex": 58,
    "nodeIndex": 59,
    "name": "foot_l",
    "humanAlias": "left foot",
    "parent": "calf_l",
    "children": [
      "ball_l"
    ],
    "depth": 4,
    "side": "left",
    "category": "leg",
    "isEndLeaf": false,
    "weightedVertexCount": 157,
    "weightSum": 135.5,
    "localTRS": {
      "translation": [
        1.0955318430205807e-8,
        0.43319371342658997,
        -8.49468051455915e-10
      ],
      "rotation": [
        -0.6838763978580877,
        0.007719457748230514,
        0.06623140077658599,
        0.7265444817599889
      ],
      "scale": [
        1,
        0.9999999403953552,
        0.9999998807907104
      ]
    }
  },
  {
    "skinJointIndex": 59,
    "nodeIndex": 60,
    "name": "ball_l",
    "humanAlias": "left ball / toe base",
    "parent": "foot_l",
    "children": [
      "ball_leaf_l"
    ],
    "depth": 5,
    "side": "left",
    "category": "leg",
    "isEndLeaf": false,
    "weightedVertexCount": 40,
    "weightSum": 22,
    "localTRS": {
      "translation": [
        -5.169567884877324e-9,
        0.18140794336795807,
        3.812601789832115e-9
      ],
      "rotation": [
        0.00011110004561487585,
        0.9767428636550903,
        -0.21441364288330078,
        0.0005055265501141548
      ],
      "scale": [
        1,
        0.9999998807907104,
        1
      ]
    }
  },
  {
    "skinJointIndex": 60,
    "nodeIndex": 61,
    "name": "ball_leaf_l",
    "humanAlias": "left toe end",
    "parent": "ball_l",
    "children": [],
    "depth": 6,
    "side": "left",
    "category": "leg",
    "isEndLeaf": false,
    "weightedVertexCount": 18,
    "weightSum": 9,
    "localTRS": {
      "translation": [
        -2.4002719811733186e-9,
        0.08628755062818527,
        -4.811440135199518e-10
      ],
      "rotation": [
        0.011352414265275002,
        -5.470733199786082e-8,
        4.351296212234956e-9,
        0.9999355673789978
      ],
      "scale": [
        1,
        0.9999998807907104,
        0.9999998807907104
      ]
    }
  },
  {
    "skinJointIndex": 61,
    "nodeIndex": 62,
    "name": "thigh_r",
    "humanAlias": "right thigh / upper leg",
    "parent": "pelvis",
    "children": [
      "calf_r"
    ],
    "depth": 2,
    "side": "right",
    "category": "leg",
    "isEndLeaf": false,
    "weightedVertexCount": 285,
    "weightSum": 170.05,
    "localTRS": {
      "translation": [
        -0.08899997174739838,
        0.02777082286775112,
        0.04602379724383354
      ],
      "rotation": [
        0.9561218955090358,
        -0.07620036307042344,
        0.0901023727262511,
        0.26815291910632566
      ],
      "scale": [
        1,
        1,
        1.000001311302185
      ]
    }
  },
  {
    "skinJointIndex": 62,
    "nodeIndex": 63,
    "name": "calf_r",
    "humanAlias": "right calf / lower leg",
    "parent": "thigh_r",
    "children": [
      "foot_r"
    ],
    "depth": 3,
    "side": "right",
    "category": "leg",
    "isEndLeaf": false,
    "weightedVertexCount": 127,
    "weightSum": 105,
    "localTRS": {
      "translation": [
        -1.5808780950976598e-9,
        0.4066256582736969,
        -1.5934258357219733e-9
      ],
      "rotation": [
        0.42048378578993084,
        0.0001191863768782751,
        0.000055176540031768606,
        0.9073000433362298
      ],
      "scale": [
        0.9999999403953552,
        1,
        0.9999999403953552
      ]
    }
  },
  {
    "skinJointIndex": 63,
    "nodeIndex": 64,
    "name": "foot_r",
    "humanAlias": "right foot",
    "parent": "calf_r",
    "children": [
      "ball_r"
    ],
    "depth": 4,
    "side": "right",
    "category": "leg",
    "isEndLeaf": false,
    "weightedVertexCount": 157,
    "weightSum": 135.5,
    "localTRS": {
      "translation": [
        -1.0955318430205807e-8,
        0.43319371342658997,
        -8.531060302630067e-10
      ],
      "rotation": [
        -0.7107360983357972,
        0.009637806550182022,
        -0.057008113743181744,
        0.7010787303682473
      ],
      "scale": [
        1,
        0.9999999403953552,
        0.9999998807907104
      ]
    }
  },
  {
    "skinJointIndex": 64,
    "nodeIndex": 65,
    "name": "ball_r",
    "humanAlias": "right ball / toe base",
    "parent": "foot_r",
    "children": [
      "ball_leaf_r"
    ],
    "depth": 5,
    "side": "right",
    "category": "leg",
    "isEndLeaf": false,
    "weightedVertexCount": 40,
    "weightSum": 22,
    "localTRS": {
      "translation": [
        5.169567884877324e-9,
        0.18140794336795807,
        3.812601789832115e-9
      ],
      "rotation": [
        0.00011111365165561438,
        -0.9767428636550903,
        0.21441364288330078,
        0.0005055337096564472
      ],
      "scale": [
        1,
        0.9999998807907104,
        1
      ]
    }
  },
  {
    "skinJointIndex": 65,
    "nodeIndex": 66,
    "name": "ball_leaf_r",
    "humanAlias": "right toe end",
    "parent": "ball_r",
    "children": [],
    "depth": 6,
    "side": "right",
    "category": "leg",
    "isEndLeaf": false,
    "weightedVertexCount": 18,
    "weightSum": 9,
    "localTRS": {
      "translation": [
        2.4002719811733186e-9,
        0.08628755062818527,
        -4.80927297985545e-10
      ],
      "rotation": [
        0.01135241612792015,
        5.47809548834266e-8,
        -1.550563411001349e-8,
        0.9999355673789978
      ],
      "scale": [
        1,
        0.9999998807907104,
        0.9999998807907104
      ]
    }
  }
] as const;

export type HumanoidV2BoneDescriptor = (typeof humanoidV2BoneDescriptors)[number];

export const humanoidV2BoneDescriptorByName = Object.freeze(
  Object.fromEntries(
    humanoidV2BoneDescriptors.map((descriptor) => [descriptor.name, descriptor])
  )
) as Readonly<Record<HumanoidV2BoneName, HumanoidV2BoneDescriptor>>;

export const humanoidV2BoneNamesByCategory = Object.freeze(
  Object.fromEntries(
    humanoidV2BoneCategories.map((category) => [
      category,
      Object.freeze(
        humanoidV2BoneDescriptors
          .filter((descriptor) => descriptor.category === category)
          .map((descriptor) => descriptor.name)
      )
    ])
  )
) as Readonly<Record<HumanoidV2BoneCategory, readonly HumanoidV2BoneName[]>>;

export const humanoidV2BoneNamesBySide = Object.freeze(
  Object.fromEntries(
    humanoidV2BoneSides.map((side) => [
      side,
      Object.freeze(
        humanoidV2BoneDescriptors
          .filter((descriptor) => descriptor.side === side)
          .map((descriptor) => descriptor.name)
      )
    ])
  )
) as Readonly<Record<HumanoidV2BoneSide, readonly HumanoidV2BoneName[]>>;
