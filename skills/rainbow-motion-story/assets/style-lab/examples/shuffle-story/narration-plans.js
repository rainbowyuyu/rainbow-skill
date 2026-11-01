// Original short scripts. Timing is planned, not measured TTS or a source transcript.
const makeBeat=(id,start,end,narration,visual,question,beforeBelief,afterBelief,extra={})=>({id,start,end,narration,visual,question,beforeBelief,afterBelief,anchorIn:'fixed-card-identities',anchorOut:'fixed-card-identities',dependsOn:[],introduces:[],uses:[],sourceIds:['executable-model'],evidence:'derived',screenText:[],readingWindow:null,sound:'先保持无声，确认动作与句子对应；正式配声保护句尾。',timingBasis:'planned',...extra});

export const plans={
 'visualization-choice-product':{
  title:'一张张选，为什么要连乘？',duration:20,
  centralQuestion:'六张不同的牌排成一行，为什么有720种顺序？',
  answer:'每次选走一张，下一位置少一种选择；乘法原理给出6×5×4×3×2×1=720。动画只选取其中一条具体路径。',
  terms:[],sources:[{id:'executable-model',path:'../../lab/modules/shuffle-explanation.js',type:'direct-enumeration-and-integer-derivation'}],
  scope:'原创短讲稿，配合同名确定性代码；没有合成配音，时长待自然语速实测。',
  beats:[
   makeBeat('choose-first',0,3.65,'六张不同的牌，第一张随你挑。','六张固定身份的牌进入视野，第一位置的可选数为6。','第一张有几种选择？','刚看见六张牌。','第一位置的每张牌都能选。',{screenText:['6种选择']}),
   makeBeat('choose-next',3.65,7.95,'拿走一张，剩五张。再拿走一张，就剩四张。','已经选中的牌留在原位；可选区减少，当前位置的因子分别出现。','下一位置还能选几张？','知道第一位置有六种选择。','选择数随着已选数量递减。',{dependsOn:['choose-first'],screenText:['6 × 5 × 4']}),
   makeBeat('finish-count',7.95,14.4,'继续往后选，每一步的选择数乘起来。','剩余3、2、1逐位置落定，因子跟随相应槽位，不重排已确认的身份。','这些选择怎样组合成总数？','看见每个位置的剩余选择数。','一条完整排列由各位置的选择共同决定。',{dependsOn:['choose-next'],screenText:['6 × 5 × 4 × 3 × 2 × 1']}),
   makeBeat('read-result',14.4,17,'总共七百二十种顺序。','结果显现后，完整乘式与720稳定保留；已选的一行是其中一种。','总共有多少种？','已经看到全部因子。','总数是720。',{dependsOn:['finish-count'],screenText:['6! = 720'],readingWindow:{start:15.1,end:17}}),
   makeBeat('hold-result',17,20,'','让观众同时看见六张牌与完整结果。','这行牌与720是什么关系？','知道总数。','这次可见排列只是720种之一。',{dependsOn:['read-result'],screenText:['这是一种排法'],readingWindow:{start:17,end:20},sound:'无声阅读窗。'})
  ]
 },
 'storytelling-perfect-shuffle':{
  title:'洗了三次，为什么又回来了？',duration:22,
  centralQuestion:'八张牌按固定规则交错，为什么三次后回到原顺序？',
  answer:'外洗把八张牌等分为两半并固定逐张交错，顶牌保留在顶。此置换作用三次等于恒等；相同规则只沿固定循环变化。',
  terms:[],sources:[{id:'executable-model',path:'../../lab/modules/shuffle-explanation.js',type:'exact-permutation'}],
  scope:'原创8张牌的小例子，不代表52张牌也是3轮，也不把外洗称作随机洗牌。时长待TTS实测。',
  beats:[
   makeBeat('set-rule',0,3.2,'这八张牌，每次都按同一个规矩洗。','八张固定ID与初始顺序先可见，随后等分；原序参考保持。','这次洗牌的规则是什么？','尚不知道洗牌条件。','每次都等分并固定交错。',{screenText:['8张牌 · 固定外洗']}),
   makeBeat('first-weave',3.2,7.2,'上下各出一张，顺序就变了。','两组沿不同通道逐张交错，落定后保留新的排列。','新顺序怎样来的？','看到上下两组。','每张牌的来源可以追踪。',{dependsOn:['set-rule'],screenText:['第1轮']}),
   makeBeat('repeat-rule',7.2,12.9,'再照这个规矩来一次。颜色还跟着原来那张牌。','重复同一规则，身份与色彩不变；第二轮结果落定。','第二轮有没有换规则？','知道第一轮的交错规则。','第二轮仍使用同一置换。',{dependsOn:['first-weave'],screenText:['第2轮']}),
   makeBeat('predict',12.9,17.7,'第三次，会排成什么样？','第三轮分组并交织，暂不提前强调最终结果。','第三轮会得到什么顺序？','已经看到两轮。','可以对照固定身份预测下一轮。',{dependsOn:['repeat-rule'],screenText:['第3轮']}),
   makeBeat('return',17.7,18.6,'回来了。','八个ID逐位与原序对应。','结果和最初有何关系？','刚完成第三轮。','逐位置完全回到原序。',{dependsOn:['predict'],screenText:['回到原序']}),
   makeBeat('hold-meaning',18.6,22,'规则没变，顺序就沿着固定的循环走。','保留原序对照和相同身份，不再加新一轮飞行动画。','这次往复告诉我们什么？','已经确认归位。','确定性置换的循环可以解释这个结果。',{dependsOn:['return'],screenText:['固定规则 → 固定循环'],readingWindow:{start:19.3,end:22}})
  ]
 }
};
export function beatAt(id,t){const p=plans[id],time=Math.max(0,Math.min(p.duration,Number.isFinite(t)?t:0));return p.beats.find(b=>time>=b.start&&time<b.end)??p.beats.at(-1);}
