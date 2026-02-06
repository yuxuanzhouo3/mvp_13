/**
 * 图片压缩工具
 * 使用 Canvas API 压缩图片，减少文件大小
 */

export interface CompressOptions {
  maxWidth?: number
  maxHeight?: number
  quality?: number
  maxSize?: number // 最大文件大小（字节）
}

/**
 * 压缩图片
 * @param file 原始图片文件
 * @param options 压缩选项
 * @returns 压缩后的 base64 字符串
 */
export async function compressImage(
  file: File,
  options: CompressOptions = {}
): Promise<string> {
  const {
    maxWidth = 1920,
    maxHeight = 1920,
    quality = 0.8,
    maxSize = 500 * 1024, // 默认 500KB
  } = options

  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    
    reader.onload = (e) => {
      const img = new Image()
      
      img.onload = () => {
        // 计算新尺寸
        let width = img.width
        let height = img.height
        
        if (width > maxWidth || height > maxHeight) {
          const ratio = Math.min(maxWidth / width, maxHeight / height)
          width = width * ratio
          height = height * ratio
        }
        
        // 创建 canvas
        const canvas = document.createElement('canvas')
        canvas.width = width
        canvas.height = height
        
        const ctx = canvas.getContext('2d')
        if (!ctx) {
          reject(new Error('无法创建 canvas 上下文'))
          return
        }
        
        // 绘制图片
        ctx.drawImage(img, 0, 0, width, height)
        
        // 转换为 base64，逐步降低质量直到满足大小要求
        let currentQuality = quality
        let result = canvas.toDataURL('image/jpeg', currentQuality)
        
        // 如果仍然太大，逐步降低质量（每次降低0.05，更精细）
        while (result.length > maxSize && currentQuality > 0.1) {
          currentQuality -= 0.05
          result = canvas.toDataURL('image/jpeg', currentQuality)
        }
        
        // 如果还是太大，进一步缩小尺寸
        if (result.length > maxSize) {
          // 计算需要缩小的比例（留10%余量）
          const sizeRatio = Math.sqrt(maxSize / result.length) * 0.9
          const newWidth = Math.max(Math.floor(width * sizeRatio), 200) // 最小200px
          const newHeight = Math.max(Math.floor(height * sizeRatio), 200)
          
          canvas.width = newWidth
          canvas.height = newHeight
          ctx.drawImage(img, 0, 0, newWidth, newHeight)
          
          // 使用较低的质量重新压缩
          currentQuality = 0.6
          result = canvas.toDataURL('image/jpeg', currentQuality)
          
          // 如果还是太大，继续降低质量
          while (result.length > maxSize && currentQuality > 0.1) {
            currentQuality -= 0.05
            result = canvas.toDataURL('image/jpeg', currentQuality)
          }
          
          // 如果仍然太大，再次缩小尺寸
          if (result.length > maxSize) {
            const finalSizeRatio = Math.sqrt(maxSize / result.length) * 0.85
            const finalWidth = Math.max(Math.floor(newWidth * finalSizeRatio), 200)
            const finalHeight = Math.max(Math.floor(newHeight * finalSizeRatio), 200)
            
            canvas.width = finalWidth
            canvas.height = finalHeight
            ctx.drawImage(img, 0, 0, finalWidth, finalHeight)
            result = canvas.toDataURL('image/jpeg', 0.5)
          }
        }
        
        resolve(result)
      }
      
      img.onerror = () => {
        reject(new Error('图片加载失败'))
      }
      
      img.src = e.target?.result as string
    }
    
    reader.onerror = () => {
      reject(new Error('文件读取失败'))
    }
    
    reader.readAsDataURL(file)
  })
}

/**
 * 批量压缩图片
 * @param files 图片文件数组
 * @param options 压缩选项
 * @returns 压缩后的 base64 字符串数组
 */
export async function compressImages(
  files: File[],
  options: CompressOptions = {}
): Promise<string[]> {
  const results = await Promise.all(
    files.map(file => compressImage(file, options))
  )
  return results
}
