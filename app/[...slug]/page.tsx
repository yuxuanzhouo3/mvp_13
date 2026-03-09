import Link from "next/link"
import { notFound } from "next/navigation"
import { Header } from "@/components/layout/header"
import { Footer } from "@/components/layout/footer"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"

type PageSection = {
  title: string
  description?: string
  items?: string[]
}

type PageConfig = {
  title: string
  subtitle: string
  highlights?: string[]
  sections: PageSection[]
  cta?: {
    label: string
    href: string
    note?: string
  }
}

const pageConfigs: Record<string, PageConfig> = {
  "resources/renters": {
    title: "租客资源",
    subtitle: "从找房到入住的全流程支持，安心、省心、透明。",
    highlights: ["租前准备", "签约保障", "入住指导", "退租清单"],
    sections: [
      {
        title: "租前准备",
        description: "预算规划、房源筛选、看房要点一次掌握。",
        items: ["预算与价格评估", "房源对比清单", "看房问题模板", "区域配套建议"],
      },
      {
        title: "合同与权益",
        description: "关键条款提醒，保护租客核心权益。",
        items: ["合同重点条款", "押金托管说明", "维修与责任边界", "续租与退租流程"],
      },
      {
        title: "入住与退租",
        description: "从入住验收到退租交接的完整指引。",
        items: ["入住验房清单", "水电燃气交接", "日常报修渠道", "退租结算流程"],
      },
      {
        title: "常见问题",
        description: "快速解决租客高频疑问。",
        items: ["租金支付方式", "押金返还时间", "纠纷处理入口", "隐私与安全提示"],
      },
    ],
    cta: {
      label: "开始找房",
      href: "/search",
      note: "智能搜索，匹配更高效。",
    },
  },
  tools: {
    title: "房东工具",
    subtitle: "高效管理房源与租客，降低运营成本。",
    highlights: ["智能定价", "租客管理", "在线签约", "资金对账"],
    sections: [
      {
        title: "房源管理",
        description: "支持多套房源的统一管理与发布。",
        items: ["批量发布与编辑", "房源状态跟踪", "图片与配套管理", "可租日期设置"],
      },
      {
        title: "租客筛选",
        description: "多维信息辅助决策，提升匹配质量。",
        items: ["申请记录汇总", "沟通与预约", "租赁资料归档", "租客画像标签"],
      },
      {
        title: "合同与收款",
        description: "电子合同与支付闭环，流程更透明。",
        items: ["在线合同签署", "租金与押金托管", "付款提醒", "对账明细导出"],
      },
      {
        title: "售后与评价",
        description: "完善的售后体验提升口碑。",
        items: ["报修与处理", "争议处理入口", "租客评价管理", "服务记录追踪"],
      },
    ],
    cta: {
      label: "发布房源",
      href: "/list-property",
      note: "创建房源后即可使用全套工具。",
    },
  },
  pricing: {
    title: "价格",
    subtitle: "清晰透明的收费方案，按需选择。",
    sections: [
      {
        title: "基础版",
        description: "适合首次发布房源的个人房东。",
        items: ["房源发布与展示", "租客申请管理", "基础客服支持", "基础数据报表"],
      },
      {
        title: "专业版",
        description: "更强的管理能力与押金保障服务。",
        items: ["押金托管服务", "在线合同签署", "消息中心", "优先客服支持"],
      },
      {
        title: "企业版",
        description: "适合多房源与团队协作。",
        items: ["多成员协作", "高级数据分析", "API 接口支持", "专属客户经理"],
      },
      {
        title: "增值服务",
        description: "按需开启，灵活可控。",
        items: ["增值推广", "背景核验", "争议调解服务", "线下看房支持"],
      },
    ],
    cta: {
      label: "咨询方案",
      href: "/contact",
      note: "根据房源规模推荐最优方案。",
    },
  },
  "success-stories": {
    title: "成功案例",
    subtitle: "来自真实用户的体验与收获。",
    highlights: ["租客满意", "房东增效", "流程透明"],
    sections: [
      {
        title: "效率提升",
        description: "房东通过统一管理平台，平均缩短空置期。",
        items: ["发布效率提升", "租客沟通更及时", "收款更可追溯"],
      },
      {
        title: "服务保障",
        description: "押金托管与争议处理机制显著降低纠纷。",
        items: ["押金处理透明", "纠纷响应更快", "平台介入更专业"],
      },
      {
        title: "租客体验",
        description: "租客能快速找到匹配房源并完成签约。",
        items: ["搜索更精准", "合同流程更顺畅", "入住体验更安心"],
      },
      {
        title: "合作伙伴",
        description: "中介与机构通过工具协作提升服务品质。",
        items: ["信息同步更及时", "客户满意度提升", "数据管理统一"],
      },
    ],
    cta: {
      label: "写评价",
      href: "/testimonial",
      note: "分享你的使用体验。",
    },
  },
  help: {
    title: "帮助中心",
    subtitle: "常见问题与操作指南一站式解决。",
    highlights: ["租客指南", "房东指南", "支付与账单", "账户安全"],
    sections: [
      {
        title: "租客问题",
        description: "从找房到退租的全流程问题解答。",
        items: ["如何发起申请", "押金如何托管", "入住与退租步骤", "争议处理入口"],
      },
      {
        title: "房东问题",
        description: "发布房源与管理租客的操作指引。",
        items: ["发布房源步骤", "租客筛选建议", "收款与对账说明", "评价与售后"],
      },
      {
        title: "支付与账单",
        description: "费用透明，账单可追溯。",
        items: ["付款方式说明", "押金状态查询", "账单下载", "退款流程"],
      },
      {
        title: "账户与安全",
        description: "账号安全与隐私保护。",
        items: ["实名认证", "账号找回", "隐私设置", "安全提示"],
      },
    ],
    cta: {
      label: "联系支持",
      href: "/contact",
      note: "在线客服将在工作时间内响应。",
    },
  },
  contact: {
    title: "联系我们",
    subtitle: "我们随时为你提供帮助。",
    sections: [
      {
        title: "客服热线",
        description: "400-888-6677（工作日 9:00-18:00）",
      },
      {
        title: "邮箱支持",
        description: "service@rentguard.cn",
      },
      {
        title: "商务合作",
        description: "business@rentguard.cn",
      },
      {
        title: "办公地址",
        description: "北京市朝阳区望京 SOHO A 座",
      },
    ],
    cta: {
      label: "前往帮助中心",
      href: "/help",
      note: "常见问题可先查看帮助中心。",
    },
  },
  "dispute-resolution": {
    title: "争议解决",
    subtitle: "公平、透明、可追溯的争议处理流程。",
    highlights: ["提交申请", "平台调解", "处理结论"],
    sections: [
      {
        title: "提交争议",
        description: "提供争议说明与必要材料，平台将及时受理。",
        items: ["纠纷描述", "图片或合同凭证", "期望处理方案", "联系信息"],
      },
      {
        title: "平台调解",
        description: "平台介入协助双方沟通并提出方案。",
        items: ["材料核验", "双方沟通", "建议方案", "进度通知"],
      },
      {
        title: "处理结果",
        description: "根据事实与规则给出处理意见并执行。",
        items: ["结果确认", "押金处理", "服务记录归档", "满意度反馈"],
      },
      {
        title: "常见纠纷",
        description: "高频问题的处理建议。",
        items: ["押金扣除争议", "设施损坏责任", "提前退租", "费用结算"],
      },
    ],
    cta: {
      label: "联系支持",
      href: "/contact",
      note: "提交争议前可先咨询客服。",
    },
  },
  about: {
    title: "关于我们",
    subtitle: "用科技让租住更安心。",
    highlights: ["安全托管", "透明流程", "高效协作"],
    sections: [
      {
        title: "使命与愿景",
        description: "打造可信赖的租赁基础设施，让每一次租住更安心。",
      },
      {
        title: "核心能力",
        description: "押金托管、争议解决、智能匹配等核心服务。",
      },
      {
        title: "服务人群",
        description: "覆盖租客、房东与中介机构的全链路需求。",
      },
      {
        title: "发展历程",
        description: "持续迭代的产品能力与合作生态。",
      },
    ],
    cta: {
      label: "查看招聘",
      href: "/careers",
      note: "与我们一起打造更好的租住体验。",
    },
  },
  careers: {
    title: "招聘",
    subtitle: "寻找志同道合的伙伴一起成长。",
    sections: [
      {
        title: "产品与设计",
        description: "产品经理、用户研究、UI/UX 设计师",
      },
      {
        title: "技术与工程",
        description: "前端工程师、后端工程师、数据工程师",
      },
      {
        title: "运营与客服",
        description: "用户运营、内容运营、客户成功",
      },
      {
        title: "商务与市场",
        description: "渠道合作、品牌市场、战略合作",
      },
    ],
    cta: {
      label: "发送简历",
      href: "/contact",
      note: "简历请发送至 hr@rentguard.cn",
    },
  },
  press: {
    title: "新闻",
    subtitle: "平台动态与产品更新。",
    sections: [
      {
        title: "平台公告",
        description: "押金托管服务范围新增多个城市。",
      },
      {
        title: "产品更新",
        description: "全新房东工具上线，支持批量管理房源。",
      },
      {
        title: "行业观点",
        description: "租赁市场趋势与合规解读。",
      },
      {
        title: "媒体报道",
        description: "RentGuard 受邀分享租赁安全标准。",
      },
    ],
    cta: {
      label: "了解平台",
      href: "/about",
      note: "更多产品与服务介绍。",
    },
  },
  legal: {
    title: "法律",
    subtitle: "平台合规与规则说明。",
    sections: [
      {
        title: "平台规则",
        description: "确保交易安全与公平的基础规范。",
        items: ["诚信原则", "信息真实性要求", "违规处理机制"],
      },
      {
        title: "合规说明",
        description: "遵循国家与地方相关法规要求。",
        items: ["数据合规", "资金托管合规", "用户权益保障"],
      },
      {
        title: "政策入口",
        description: "查看完整政策与条款。",
        items: ["隐私政策", "服务条款", "Cookie 政策"],
      },
      {
        title: "风险提示",
        description: "平台提示与安全建议。",
        items: ["避免线下私下交易", "警惕异常付款请求", "保存关键证据"],
      },
    ],
    cta: {
      label: "查看隐私政策",
      href: "/privacy",
      note: "了解我们如何保护你的信息。",
    },
  },
  privacy: {
    title: "隐私政策",
    subtitle: "我们重视你的个人信息与隐私权。",
    sections: [
      {
        title: "信息收集",
        description: "为提供服务所必需的信息将被收集。",
        items: ["账号信息", "租赁相关信息", "设备与日志信息"],
      },
      {
        title: "信息使用",
        description: "用于提供服务、优化体验与安全保障。",
        items: ["身份验证", "交易处理", "客户支持", "风险控制"],
      },
      {
        title: "信息共享",
        description: "仅在必要场景与合规范围内共享。",
        items: ["与合作方的必要共享", "依法披露", "用户授权"],
      },
      {
        title: "用户权利",
        description: "你可以随时管理与更正个人信息。",
        items: ["访问与更正", "删除与撤回", "注销账号"],
      },
    ],
    cta: {
      label: "查看服务条款",
      href: "/terms",
      note: "了解平台服务范围与责任。",
    },
  },
  terms: {
    title: "服务条款",
    subtitle: "使用 RentGuard 服务的相关约定。",
    sections: [
      {
        title: "服务范围",
        description: "平台提供信息发布、匹配与交易支持服务。",
        items: ["房源信息展示", "在线沟通工具", "押金与支付服务"],
      },
      {
        title: "用户责任",
        description: "请确保信息真实、合法并遵守规则。",
        items: ["信息真实性", "合法合规使用", "账户安全维护"],
      },
      {
        title: "费用与结算",
        description: "费用按服务说明执行，结算透明可追溯。",
        items: ["服务费用", "押金托管", "退款规则"],
      },
      {
        title: "免责声明",
        description: "平台在合理范围内提供技术与服务支持。",
        items: ["不可抗力", "第三方服务限制", "风险提示"],
      },
    ],
    cta: {
      label: "查看 Cookie 政策",
      href: "/cookies",
      note: "了解 Cookie 的使用方式。",
    },
  },
  cookies: {
    title: "Cookie 政策",
    subtitle: "我们如何使用 Cookie 改善体验。",
    sections: [
      {
        title: "使用目的",
        description: "帮助记住你的偏好并提升体验。",
        items: ["登录状态保持", "个性化设置", "性能统计"],
      },
      {
        title: "Cookie 类型",
        description: "不同类型 Cookie 对应不同用途。",
        items: ["必要 Cookie", "分析 Cookie", "功能 Cookie"],
      },
      {
        title: "管理方式",
        description: "你可以随时调整浏览器设置。",
        items: ["浏览器设置管理", "禁用提示", "清除 Cookie"],
      },
      {
        title: "第三方服务",
        description: "部分第三方服务可能使用 Cookie。",
        items: ["统计与分析工具", "安全验证服务"],
      },
    ],
    cta: {
      label: "返回隐私政策",
      href: "/privacy",
      note: "查看完整隐私保护说明。",
    },
  },
}

export default async function FooterInfoPage({ params }: { params: Promise<{ slug?: string[] }> }) {
  const { slug } = await params
  const pathKey = (slug || []).join("/")
  const config = pageConfigs[pathKey]

  if (!config) {
    notFound()
  }

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="container py-12">
        <div className="max-w-5xl mx-auto space-y-10">
          <div className="text-center space-y-4">
            <h1 className="text-4xl font-bold">{config.title}</h1>
            <p className="text-xl text-muted-foreground">{config.subtitle}</p>
            {config.highlights && (
              <div className="flex flex-wrap justify-center gap-2">
                {config.highlights.map((item) => (
                  <Badge key={item} variant="secondary">
                    {item}
                  </Badge>
                ))}
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {config.sections.map((section) => (
              <Card key={section.title}>
                <CardHeader>
                  <CardTitle>{section.title}</CardTitle>
                  {section.description && (
                    <CardDescription>{section.description}</CardDescription>
                  )}
                </CardHeader>
                {(section.items && section.items.length > 0) ? (
                  <CardContent>
                    <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground">
                      {section.items.map((item) => (
                        <li key={item}>{item}</li>
                      ))}
                    </ul>
                  </CardContent>
                ) : null}
              </Card>
            ))}
          </div>

          {config.cta && (
            <Card>
              <CardContent className="p-6 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <div className="space-y-1">
                  <div className="text-lg font-semibold">{config.cta.label}</div>
                  {config.cta.note && (
                    <div className="text-sm text-muted-foreground">{config.cta.note}</div>
                  )}
                </div>
                <Button asChild>
                  <Link href={config.cta.href}>{config.cta.label}</Link>
                </Button>
              </CardContent>
            </Card>
          )}
        </div>
      </main>
      <Footer />
    </div>
  )
}
